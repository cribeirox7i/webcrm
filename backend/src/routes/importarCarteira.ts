import { Router } from "express";
import { query, withTransaction } from "../db";
import { escolhePorNome, normalizaCnpj, type ClienteCandidato } from "../matchCliente";
import { dataIso, inteiro, numero, texto } from "../planilhaValores";

// Importação mensal da planilha de medição para a tabela `carteira` (Admin > Importar Carteira).
// A planilha é lida no navegador (exceljs, já usado na exportação) e chega aqui como JSON --
// o backend é dono das regras de identificação do cliente, da limpeza do mês e da gravação.
//
// Sempre roda em duas etapas: `simular: true` devolve o relatório completo sem gravar nada, e
// a tela só chama de novo com `simular: false` depois que o usuário confere e confirma.
export const importarCarteiraRouter = Router();

export interface LinhaMedicao {
  nome?: string | null;
  cnpj?: string | null;
  qtd?: unknown;
  vlr?: unknown;
  pdd?: unknown;
  semPdd?: unknown;
  fat?: unknown;
  qtdMes?: unknown;
  emprestimosMes?: unknown;
  ultDef?: unknown;
  dataBase?: unknown;
  datExtracao?: unknown;
  rds?: string | null;
  db?: string | null;
  prod?: string | null;
}

type Origem = "cnpj" | "nome" | "database" | "manual";

importarCarteiraRouter.post("/admin/importar-carteira", async (req, res) => {
  const { cartMesId, linhas, simular, correcoes } = (req.body ?? {}) as {
    cartMesId?: unknown;
    linhas?: unknown;
    simular?: unknown;
    // { índice da linha na planilha -> cliente_id escolhido à mão }, quando o usuário não
    // concorda com o cliente que a heurística escolheu (ver relatório na tela).
    correcoes?: unknown;
  };

  const correcoesPorIndice = new Map<number, number>();
  if (correcoes && typeof correcoes === "object") {
    Object.entries(correcoes as Record<string, unknown>).forEach(([k, v]) => {
      const indice = Number(k);
      const clienteId = Number(v);
      if (Number.isInteger(indice) && Number.isInteger(clienteId) && clienteId > 0) {
        correcoesPorIndice.set(indice, clienteId);
      }
    });
  }

  const mesId = Number(cartMesId);
  if (!Number.isInteger(mesId) || mesId <= 0) {
    res.status(400).json({ error: "cartMesId inválido" });
    return;
  }
  if (!Array.isArray(linhas) || linhas.length === 0) {
    res.status(400).json({ error: "nenhuma linha recebida da planilha" });
    return;
  }

  const { rows: mesRows } = await query<{ cart_mes_id: number; cart_ano_mes: string }>(
    "SELECT cart_mes_id, cart_ano_mes FROM cart_mes WHERE cart_mes_id = $1",
    [mesId]
  );
  if (!mesRows[0]) {
    res.status(404).json({ error: "mês (cart_mes) não encontrado" });
    return;
  }

  // ---- índices de identificação ----
  const { rows: clientes } = await query<ClienteCandidato & { cnpj_norm: string }>(
    `SELECT cliente_id, cliente_nome,
            UPPER(REGEXP_REPLACE(cliente_cnpj, '[^A-Za-z0-9]', '', 'g')) AS cnpj_norm
     FROM clientes`
  );
  const porCnpj = new Map<string, ClienteCandidato[]>();
  clientes.forEach((c) => {
    if (!c.cnpj_norm) return;
    const lista = porCnpj.get(c.cnpj_norm) ?? [];
    lista.push({ cliente_id: c.cliente_id, cliente_nome: c.cliente_nome });
    porCnpj.set(c.cnpj_norm, lista);
  });

  // último cliente conhecido por database, a partir do histórico da própria carteira
  const { rows: dbRows } = await query<{ cart_db: string; cliente_id: number; cliente_nome: string }>(
    `SELECT DISTINCT ON (c.cart_db) c.cart_db, c.cliente_id, cl.cliente_nome
     FROM carteira c JOIN clientes cl ON cl.cliente_id = c.cliente_id
     WHERE c.cart_db IS NOT NULL AND c.cart_db <> '' AND c.cliente_id IS NOT NULL
       AND c.cart_mes_id <> $1
     ORDER BY c.cart_db, c.cart_id DESC`,
    [mesId]
  );
  const porDatabase = new Map(dbRows.map((r) => [r.cart_db.trim().toLowerCase(), r]));

  // ---- classificação ----
  const paraInserir: { linha: LinhaMedicao; clienteId: number; origem: Origem }[] = [];
  const resolvidosPorNome: { indice: number; nome: string; cnpj: string; clienteId: number; clienteNome: string }[] = [];
  const resolvidosPorDatabase: { indice: number; nome: string; db: string; clienteId: number; clienteNome: string }[] = [];
  const ignorados: {
    indice: number;
    nome: string;
    cnpj: string;
    db: string;
    motivo: string;
    clienteIdSugerido?: number;
    clienteNomeSugerido?: string;
  }[] = [];

  const nomePorClienteId = new Map(clientes.map((c) => [c.cliente_id, c.cliente_nome]));

  (linhas as LinhaMedicao[]).forEach((bruta, indice) => {
    const nome = texto(bruta.nome) ?? "";
    const cnpj = normalizaCnpj(bruta.cnpj);
    const db = texto(bruta.db) ?? "";

    // correção manual do usuário vence qualquer heurística -- mas ainda aparece na tabela de
    // origem correspondente, com o cliente corrigido, pra continuar auditável no relatório.
    const corrigido = correcoesPorIndice.get(indice);

    // candidatos por CNPJ/database são calculados antes do filtro de linha zerada, pra que uma
    // linha ignorada por estar zerada ainda venha com sugestão de cliente no relatório (o
    // usuário via CNPJ batendo mas "não identificado" nas ignoradas -- o cliente é achado, só não
    // é importado por estar zerado).
    const candidatos = cnpj ? porCnpj.get(cnpj) ?? [] : [];
    const viaDb = db ? porDatabase.get(db.toLowerCase()) : undefined;
    const sugestao: ClienteCandidato | null =
      candidatos.length === 1
        ? candidatos[0]
        : candidatos.length > 1
          ? escolhePorNome(nome, candidatos)
          : viaDb
            ? { cliente_id: viaDb.cliente_id, cliente_nome: viaDb.cliente_nome }
            : null;

    // linha sem atividade nenhuma (decisão do usuário: desprezar) -- vazio conta como zero pra
    // esse fim. Corrigir manualmente na tabela de ignorados ainda resgata a linha, se um dia
    // fizer sentido importar uma dessas mesmo assim.
    const ehZero = (v: unknown) => {
      const n = numero(v);
      return n == null || n === 0;
    };
    if (ehZero(bruta.vlr) && ehZero(bruta.qtd) && ehZero(bruta.qtdMes) && !corrigido) {
      ignorados.push({
        indice,
        nome,
        cnpj,
        db,
        motivo: "Carteira, operações e operações no mês zeradas",
        clienteIdSugerido: sugestao?.cliente_id,
        clienteNomeSugerido: sugestao?.cliente_nome,
      });
      return;
    }

    if (candidatos.length === 1 && !corrigido) {
      paraInserir.push({ linha: bruta, clienteId: candidatos[0].cliente_id, origem: "cnpj" });
      return;
    }
    if (candidatos.length > 1) {
      const clienteId = corrigido ?? sugestao!.cliente_id;
      paraInserir.push({ linha: bruta, clienteId, origem: corrigido ? "manual" : "nome" });
      resolvidosPorNome.push({
        indice,
        nome,
        cnpj,
        clienteId,
        clienteNome: nomePorClienteId.get(clienteId) ?? "",
      });
      return;
    }
    if (viaDb || corrigido) {
      const clienteId = corrigido ?? viaDb!.cliente_id;
      paraInserir.push({ linha: bruta, clienteId, origem: corrigido ? "manual" : "database" });
      resolvidosPorDatabase.push({
        indice,
        nome,
        db,
        clienteId,
        clienteNome: nomePorClienteId.get(clienteId) ?? "",
      });
      return;
    }
    ignorados.push({
      indice,
      nome,
      cnpj,
      db,
      motivo: cnpj ? "CNPJ não cadastrado e database sem histórico" : "linha sem CNPJ",
    });
  });

  const { rows: existentes } = await query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM carteira WHERE cart_mes_id = $1",
    [mesId]
  );

  const relatorio = {
    mes: mesRows[0].cart_ano_mes,
    linhasNaPlanilha: (linhas as unknown[]).length,
    aInserir: paraInserir.length,
    porCnpj: paraInserir.filter((p) => p.origem === "cnpj").length,
    porNome: resolvidosPorNome,
    porDatabase: resolvidosPorDatabase,
    ignorados,
    // só na simulação -- a tela usa isso pra montar o dropdown de correção manual; não precisa
    // ir de novo na resposta de confirmação (`simular: false`), que já é o resultado final.
    clientes: simular !== false ? clientes.map((c) => ({ cliente_id: c.cliente_id, cliente_nome: c.cliente_nome })) : undefined,
    linhasExistentesNoMes: existentes[0].n,
  };

  if (simular !== false) {
    res.json({ simulado: true, ...relatorio });
    return;
  }

  // ---- gravação (substitui o mês inteiro, decisão do usuário) ----
  try {
    await withTransaction(async (client) => {
      await client.query("DELETE FROM carteira WHERE cart_mes_id = $1", [mesId]);
      for (const { linha, clienteId } of paraInserir) {
        await client.query(
          `INSERT INTO carteira (
             cliente_id, cart_mes_id, cart_qtd, cart_vlr, cart_pdd, cart_sem_pdd, cart_fat,
             cart_qtd_mes, cart_emprestimos_mes, cart_ult_def, cart_data_base, cart_dat_extracao,
             cart_rds, cart_db, cart_prod
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            clienteId,
            mesId,
            inteiro(linha.qtd),
            numero(linha.vlr),
            numero(linha.pdd),
            numero(linha.semPdd),
            numero(linha.fat),
            inteiro(linha.qtdMes),
            numero(linha.emprestimosMes),
            dataIso(linha.ultDef),
            dataIso(linha.dataBase),
            dataIso(linha.datExtracao, true),
            texto(linha.rds),
            texto(linha.db),
            texto(linha.prod),
          ]
        );
      }
    });
  } catch (err) {
    res.status(500).json({ error: `falha ao importar: ${(err as Error).message}` });
    return;
  }

  res.json({ simulado: false, ...relatorio, inseridos: paraInserir.length, apagados: existentes[0].n });
});
