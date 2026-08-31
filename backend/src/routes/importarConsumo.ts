import { Router } from "express";
import { query, withTransaction } from "../db";
import { normalizaCnpj, type ClienteCandidato } from "../matchCliente";
import { dataIso, numero, texto } from "../planilhaValores";

// Importação mensal do consumo analítico (Admin > Financeiro > Importar Consumo). Diferente da
// importação de carteira, aqui um "arquivo" real é um GRUPO de planilhas/CSVs (todas no mesmo
// layout: ID_Produto;CNPJ;Data;quantidade;Detalhamento) -- o frontend já lê e concatena todas
// antes de mandar pra cá, então esta rota só vê uma lista `linhas` só, igual à de carteira.
//
// Três efeitos por importação (sempre os três juntos, mesmo cart_mes_id):
//   1. `consumo_ana`: uma linha por linha do arquivo (ID_Produto -> produto_id direto, sem
//      match por nome -- é a chave real; CNPJ -> cliente_id via normalização, igual carteira).
//   2. `precos_cliente`: duplica TODAS as linhas do cart_mes_id mais recente que já tem preço
//      cadastrado (excluindo o mês alvo) pro mês novo -- carrega adiante a tabela de preços/
//      franquia vigente, decisão do usuário (a tabela de preços não muda todo mês).
//   3. `faturamento`: uma linha-âncora (cliente_id, cart_mes_id) por cliente distinto que
//      apareceu em `consumo_ana` nesta importação -- os valores (fat_vlr_liq/brt) não ficam
//      armazenados aqui, são calculados ao vivo pela view `faturamento_detalhe` a partir de
//      `precos_cliente_mes_atual` (que já cruza consumo_ana + precos_cliente pelo cart_mes_id).
//
// Igual carteira: `simular: true` devolve o relatório completo sem gravar nada; `simular: false`
// GRAVA de vez, e sempre substitui o mês inteiro (DELETE + INSERT nas três tabelas) -- reimportar
// o mesmo mês é idempotente.
export const importarConsumoRouter = Router();

export interface LinhaConsumo {
  idProduto?: unknown;
  cnpj?: string | null;
  data?: unknown;
  quantidade?: unknown;
  detalhamento?: string | null;
}

interface ItemParaInserir {
  clienteId: number;
  produtoId: number;
  consumoData: string | null;
  qtd: number | null;
  det: string | null;
}

importarConsumoRouter.post("/admin/importar-consumo", async (req, res) => {
  const { cartMesId, linhas, simular, correcoesCnpj, correcoesProduto } = (req.body ?? {}) as {
    cartMesId?: unknown;
    linhas?: unknown;
    simular?: unknown;
    // { CNPJ normalizado -> cliente_id escolhido à mão }, pra CNPJ sem match único (ambíguo ou
    // não cadastrado) -- agrupado por CNPJ, não por linha, porque um CNPJ se repete em dezenas/
    // centenas de linhas neste arquivo (um log de checagem por evento).
    correcoesCnpj?: unknown;
    // { ID_Produto original (texto) -> produto_id escolhido à mão }, mesma lógica agrupada.
    correcoesProduto?: unknown;
  };

  const mesId = Number(cartMesId);
  if (!Number.isInteger(mesId) || mesId <= 0) {
    res.status(400).json({ error: "cartMesId inválido" });
    return;
  }
  if (!Array.isArray(linhas) || linhas.length === 0) {
    res.status(400).json({ error: "nenhuma linha recebida das planilhas" });
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

  const correcoesCnpjMap = new Map<string, number>();
  if (correcoesCnpj && typeof correcoesCnpj === "object") {
    Object.entries(correcoesCnpj as Record<string, unknown>).forEach(([k, v]) => {
      const clienteId = Number(v);
      if (k && Number.isInteger(clienteId) && clienteId > 0) correcoesCnpjMap.set(k, clienteId);
    });
  }
  const correcoesProdutoMap = new Map<string, number>();
  if (correcoesProduto && typeof correcoesProduto === "object") {
    Object.entries(correcoesProduto as Record<string, unknown>).forEach(([k, v]) => {
      const produtoId = Number(v);
      if (k && Number.isInteger(produtoId) && produtoId > 0) correcoesProdutoMap.set(k, produtoId);
    });
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

  const { rows: produtos } = await query<{ produto_id: number; produto_nome: string }>(
    "SELECT produto_id, produto_nome FROM produtos"
  );
  const produtoIdsValidos = new Set(produtos.map((p) => p.produto_id));

  // ---- classificação (agrupada por CNPJ / ID_Produto, não por linha -- ver comentário no topo) ----
  const paraInserir: ItemParaInserir[] = [];
  const cnpjsPendentes = new Map<string, { cnpjOriginal: string; linhas: number }>();
  const produtosPendentes = new Map<string, number>(); // idProdutoOriginal -> contagem de linhas

  (linhas as LinhaConsumo[]).forEach((bruta) => {
    const cnpjOriginal = texto(bruta.cnpj) ?? "";
    const cnpjNorm = normalizaCnpj(bruta.cnpj);
    const idProdutoOriginal = texto(bruta.idProduto) ?? "";
    const idProdutoNum = Number(idProdutoOriginal);

    const candidatosCliente = cnpjNorm ? porCnpj.get(cnpjNorm) ?? [] : [];
    const clienteId =
      correcoesCnpjMap.get(cnpjNorm) ?? (candidatosCliente.length === 1 ? candidatosCliente[0].cliente_id : undefined);

    const produtoValido = Number.isInteger(idProdutoNum) && produtoIdsValidos.has(idProdutoNum);
    const produtoId = correcoesProdutoMap.get(idProdutoOriginal) ?? (produtoValido ? idProdutoNum : undefined);

    if (!clienteId) {
      const atual = cnpjsPendentes.get(cnpjNorm) ?? { cnpjOriginal, linhas: 0 };
      atual.linhas += 1;
      cnpjsPendentes.set(cnpjNorm, atual);
    }
    if (!produtoId) {
      produtosPendentes.set(idProdutoOriginal, (produtosPendentes.get(idProdutoOriginal) ?? 0) + 1);
    }
    if (!clienteId || !produtoId) return;

    paraInserir.push({
      clienteId,
      produtoId,
      consumoData: dataIso(bruta.data, true),
      qtd: numero(bruta.quantidade),
      det: texto(bruta.detalhamento),
    });
  });

  // ---- origem da duplicação de precos_cliente: cart_mes_id mais recente (por cart_ano_mes)
  // que já tem alguma linha em precos_cliente, excluindo o próprio mês alvo ----
  const { rows: origemRows } = await query<{ cart_mes_id: number; cart_ano_mes: string; n: number }>(
    `SELECT pc.cart_mes_id, cm.cart_ano_mes, COUNT(*)::int AS n
     FROM precos_cliente pc JOIN cart_mes cm ON cm.cart_mes_id = pc.cart_mes_id
     WHERE pc.cart_mes_id <> $1
     GROUP BY pc.cart_mes_id, cm.cart_ano_mes
     ORDER BY cm.cart_ano_mes DESC
     LIMIT 1`,
    [mesId]
  );
  const precosOrigem = origemRows[0]
    ? { cartMesId: origemRows[0].cart_mes_id, anoMes: origemRows[0].cart_ano_mes, linhas: origemRows[0].n }
    : null;

  const { rows: existentesConsumo } = await query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM consumo_ana WHERE cart_mes_id = $1",
    [mesId]
  );
  const { rows: existentesPrecos } = await query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM precos_cliente WHERE cart_mes_id = $1",
    [mesId]
  );
  const { rows: existentesFaturamento } = await query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM faturamento WHERE cart_mes_id = $1",
    [mesId]
  );

  const clientesPorId = new Map(clientes.map((c) => [c.cliente_id, c.cliente_nome]));
  const relatorio = {
    mes: mesRows[0].cart_ano_mes,
    linhasNaPlanilha: (linhas as unknown[]).length,
    aInserir: paraInserir.length,
    clientesDistintos: new Set(paraInserir.map((p) => p.clienteId)).size,
    cnpjsPendentes: [...cnpjsPendentes.entries()].map(([cnpjNorm, v]) => ({
      cnpj: v.cnpjOriginal,
      linhas: v.linhas,
      // candidatos com esse CNPJ (caso ambíguo -- mais de 1 cliente com o mesmo CNPJ
      // cadastrado); vazio quando o CNPJ simplesmente não existe em `clientes`.
      candidatos: (porCnpj.get(cnpjNorm) ?? []).map((c) => ({ cliente_id: c.cliente_id, cliente_nome: clientesPorId.get(c.cliente_id) ?? c.cliente_nome })),
    })),
    produtosPendentes: [...produtosPendentes.entries()].map(([idProduto, n]) => ({ idProduto, linhas: n })),
    precosOrigem,
    consumoExistenteNoMes: existentesConsumo[0].n,
    precosExistentesNoMes: existentesPrecos[0].n,
    faturamentoExistenteNoMes: existentesFaturamento[0].n,
    // só na simulação -- dropdowns de correção manual; não precisa ir de novo na confirmação.
    clientes: simular !== false ? clientes.map((c) => ({ cliente_id: c.cliente_id, cliente_nome: c.cliente_nome })) : undefined,
    produtos: simular !== false ? produtos : undefined,
  };

  if (simular !== false) {
    res.json({ simulado: true, ...relatorio });
    return;
  }

  // ---- gravação (substitui o mês inteiro nas 3 tabelas, decisão do usuário) ----
  let precosDuplicados = 0;
  try {
    await withTransaction(async (client) => {
      await client.query("DELETE FROM consumo_ana WHERE cart_mes_id = $1", [mesId]);
      await client.query("DELETE FROM precos_cliente WHERE cart_mes_id = $1", [mesId]);
      await client.query("DELETE FROM faturamento WHERE cart_mes_id = $1", [mesId]);

      for (const item of paraInserir) {
        await client.query(
          `INSERT INTO consumo_ana (cliente_id, produto_id, cart_mes_id, consumo_data, consumo_qtd, consumo_det)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [item.clienteId, item.produtoId, mesId, item.consumoData, item.qtd, item.det]
        );
      }

      if (precosOrigem) {
        const dup = await client.query(
          `INSERT INTO precos_cliente (
             cliente_id, produto_id, cart_mes_id, pc_dat_niver, pc_dat_ult_reajuste, pc_cod_index,
             pc_vlr_franquia, pc_vlr_unit,
             pc_fx1_lim, pc_fx2_lim, pc_fx3_lim, pc_fx4_lim, pc_fx5_lim,
             pc_fx1_vlr, pc_fx2_vlr, pc_fx3_vlr, pc_fx4_vlr, pc_fx5_vlr
           )
           SELECT
             cliente_id, produto_id, $2, pc_dat_niver, pc_dat_ult_reajuste, pc_cod_index,
             pc_vlr_franquia, pc_vlr_unit,
             pc_fx1_lim, pc_fx2_lim, pc_fx3_lim, pc_fx4_lim, pc_fx5_lim,
             pc_fx1_vlr, pc_fx2_vlr, pc_fx3_vlr, pc_fx4_vlr, pc_fx5_vlr
           FROM precos_cliente
           WHERE cart_mes_id = $1`,
          [precosOrigem.cartMesId, mesId]
        );
        precosDuplicados = dup.rowCount ?? 0;
      }

      const clienteIdsDistintos = [...new Set(paraInserir.map((p) => p.clienteId))];
      for (const clienteId of clienteIdsDistintos) {
        await client.query("INSERT INTO faturamento (cliente_id, cart_mes_id) VALUES ($1,$2)", [clienteId, mesId]);
      }
    });
  } catch (err) {
    res.status(500).json({ error: `falha ao importar: ${(err as Error).message}` });
    return;
  }

  res.json({
    simulado: false,
    ...relatorio,
    consumoInseridos: paraInserir.length,
    consumoApagados: existentesConsumo[0].n,
    precosDuplicados,
    precosApagados: existentesPrecos[0].n,
    faturamentoInseridos: new Set(paraInserir.map((p) => p.clienteId)).size,
    faturamentoApagados: existentesFaturamento[0].n,
  });
});
