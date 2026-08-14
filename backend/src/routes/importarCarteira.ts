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

type Origem = "cnpj" | "nome" | "database";

importarCarteiraRouter.post("/admin/importar-carteira", async (req, res) => {
  const { cartMesId, linhas, simular } = (req.body ?? {}) as {
    cartMesId?: unknown;
    linhas?: unknown;
    simular?: unknown;
  };

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
  const resolvidosPorNome: { nome: string; cnpj: string; clienteId: number; clienteNome: string }[] = [];
  const resolvidosPorDatabase: { nome: string; db: string; clienteId: number; clienteNome: string }[] = [];
  const ignorados: { nome: string; cnpj: string; db: string; motivo: string }[] = [];

  for (const bruta of linhas as LinhaMedicao[]) {
    const nome = texto(bruta.nome) ?? "";
    const cnpj = normalizaCnpj(bruta.cnpj);
    const db = texto(bruta.db) ?? "";

    const candidatos = cnpj ? porCnpj.get(cnpj) ?? [] : [];
    if (candidatos.length === 1) {
      paraInserir.push({ linha: bruta, clienteId: candidatos[0].cliente_id, origem: "cnpj" });
      continue;
    }
    if (candidatos.length > 1) {
      const escolhido = escolhePorNome(nome, candidatos)!;
      paraInserir.push({ linha: bruta, clienteId: escolhido.cliente_id, origem: "nome" });
      resolvidosPorNome.push({ nome, cnpj, clienteId: escolhido.cliente_id, clienteNome: escolhido.cliente_nome });
      continue;
    }
    const viaDb = db ? porDatabase.get(db.toLowerCase()) : undefined;
    if (viaDb) {
      paraInserir.push({ linha: bruta, clienteId: viaDb.cliente_id, origem: "database" });
      resolvidosPorDatabase.push({ nome, db, clienteId: viaDb.cliente_id, clienteNome: viaDb.cliente_nome });
      continue;
    }
    ignorados.push({
      nome,
      cnpj,
      db,
      motivo: cnpj ? "CNPJ não cadastrado e database sem histórico" : "linha sem CNPJ",
    });
  }

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
