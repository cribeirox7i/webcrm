import { Router } from "express";
import { query, withTransaction } from "../db";

// Formato mínimo compatível tanto com `query()` (db.ts, fora de transação) quanto com
// `client.query()` (PoolClient do `pg`, dentro de `withTransaction`) -- calcularCandidatos roda
// nos dois contextos (leitura simples em /simular, dentro da transação em /aplicar).
type Queryer = { query: <T>(text: string, params?: unknown[]) => Promise<{ rows: T[] }> };

// POST /api/admin/reajuste/simular e /aplicar -- reajuste de pc_vlr_unit/pc_vlr_franquia dos
// contratos (precos_cliente) com aniversário (pc_dat_niver) no mês corrente, usando o acumulado
// de 12 meses do indexador do contrato (pc_cod_index) no mês/ano corrente (indices_calculados.
// index_acum_12m). Fórmula (decisão do usuário, 2026-09-01): novo_valor = valor_atual * (1 +
// index_acum_12m) -- index_acum_12m já vem como fração decimal da view, não percentual.
// Montado sob requireAdmin (server.ts) -- só o PIN mestre do Admin dispara.
export const adminReajusteRouter = Router();

interface CandidatoRow {
  pc_id: number;
  cliente_id: number;
  cliente_nome: string;
  cliente_cnpj: string | null;
  produto_id: number;
  produto_nome: string;
  produto_detalhe: string | null;
  pc_dat_niver: string;
  pc_cod_index: string | null;
  pc_vlr_unit: number | null;
  pc_vlr_franquia: number | null;
  index_acum_12m: number | null;
  ja_aplicado: boolean;
}

export interface CandidatoReajuste {
  pc_id: number;
  cliente_id: number;
  cliente_nome: string;
  cliente_cnpj: string | null;
  produto_id: number;
  produto_nome: string;
  produto_detalhe: string | null;
  pc_dat_niver: string;
  pc_cod_index: string | null;
  index_ano: number;
  index_mes: number;
  index_acum_12m: number | null;
  vlr_unit_atual: number | null;
  vlr_unit_novo: number | null;
  vlr_franquia_atual: number | null;
  vlr_franquia_novo: number | null;
  status: "aplicavel" | "sem_indexador" | "sem_indice_mes_corrente" | "acumulado_negativo" | "ja_aplicado";
}

/** Busca os contratos com aniversário no mês/ano de referência e calcula o reajuste de cada um
 * -- usada tanto por /simular quanto por /aplicar (que recalcula do zero em vez de confiar nos
 * valores que o frontend mandou de volta, pra evitar aplicar um reajuste com dado desatualizado
 * caso o índice tenha mudado ou outro reajuste já tenha rodado entre a simulação e a confirmação). */
async function calcularCandidatos(client: Queryer, anoRef: number, mesRef: number): Promise<CandidatoReajuste[]> {
  const { rows } = await client.query<CandidatoRow>(
    `SELECT
       pc.pc_id, pc.cliente_id, c.cliente_nome, c.cliente_cnpj,
       pc.produto_id, p.produto_nome, p.produto_detalhe,
       pc.pc_dat_niver, pc.pc_cod_index, pc.pc_vlr_unit, pc.pc_vlr_franquia,
       ic.index_acum_12m,
       EXISTS (
         SELECT 1 FROM reajuste_eventos re
         WHERE re.pc_id = pc.pc_id AND re.reaj_index_ano = $1 AND re.reaj_index_mes = $2
       ) AS ja_aplicado
     FROM precos_cliente pc
     JOIN clientes c ON c.cliente_id = pc.cliente_id
     JOIN produtos p ON p.produto_id = pc.produto_id
     LEFT JOIN indices_calculados ic
       ON ic.index_nome = pc.pc_cod_index AND ic.index_ano = $1 AND ic.index_mes = $2
     WHERE pc.pc_dat_niver ~ '^\\d{4}-\\d{2}-\\d{2}'
       AND EXTRACT(MONTH FROM pc.pc_dat_niver::date) = $2
     ORDER BY c.cliente_nome, p.produto_nome`,
    [anoRef, mesRef]
  );

  return rows.map((r) => {
    let status: CandidatoReajuste["status"];
    if (r.ja_aplicado) status = "ja_aplicado";
    else if (!r.pc_cod_index) status = "sem_indexador";
    else if (r.index_acum_12m == null) status = "sem_indice_mes_corrente";
    // acumulado negativo (deflação) não gera reajuste pra baixo -- decisão do usuário, 2026-09-01
    else if (r.index_acum_12m < 0) status = "acumulado_negativo";
    else status = "aplicavel";

    const fator = status === "aplicavel" ? 1 + (r.index_acum_12m as number) : null;

    return {
      pc_id: r.pc_id,
      cliente_id: r.cliente_id,
      cliente_nome: r.cliente_nome,
      cliente_cnpj: r.cliente_cnpj,
      produto_id: r.produto_id,
      produto_nome: r.produto_nome,
      produto_detalhe: r.produto_detalhe,
      pc_dat_niver: r.pc_dat_niver,
      pc_cod_index: r.pc_cod_index,
      index_ano: anoRef,
      index_mes: mesRef,
      index_acum_12m: r.index_acum_12m,
      vlr_unit_atual: r.pc_vlr_unit,
      vlr_unit_novo: fator != null && r.pc_vlr_unit != null ? r.pc_vlr_unit * fator : null,
      vlr_franquia_atual: r.pc_vlr_franquia,
      vlr_franquia_novo: fator != null && r.pc_vlr_franquia != null ? r.pc_vlr_franquia * fator : null,
      status,
    };
  });
}

function refAtual(): { anoRef: number; mesRef: number } {
  const hoje = new Date();
  return { anoRef: hoje.getFullYear(), mesRef: hoje.getMonth() + 1 };
}

// POST /simular -- só lê, não grava nada. Devolve todos os contratos com aniversário no mês
// corrente, cada um com o status (aplicável / sem indexador / sem índice do mês corrente ainda
// sincronizado / já reajustado este mês) e o valor novo já calculado pros aplicáveis.
adminReajusteRouter.post("/simular", async (_req, res) => {
  const { anoRef, mesRef } = refAtual();
  const candidatos = await calcularCandidatos({ query }, anoRef, mesRef);
  res.json({ ok: true, anoRef, mesRef, candidatos });
});

// POST /aplicar -- body: { pcIds: number[] } (os pc_id marcados pelo usuário na tela, normalmente
// só os "aplicavel" da simulação). Recalcula do zero dentro da transação e só grava os que ainda
// estiverem "aplicavel" nesse recálculo -- qualquer um que mudou de status entre a simulação e a
// confirmação (outro reajuste aplicado nesse meio-tempo, índice removido etc.) é reportado em
// `ignorados`, não interrompe os demais.
adminReajusteRouter.post("/aplicar", async (req, res) => {
  const pcIds = Array.isArray(req.body?.pcIds) ? (req.body.pcIds as unknown[]).map(Number).filter(Number.isFinite) : [];
  if (!pcIds.length) {
    res.status(400).json({ error: "pcIds vazio" });
    return;
  }
  const { anoRef, mesRef } = refAtual();
  const pcIdsSet = new Set(pcIds);

  const resultado = await withTransaction(async (client) => {
    const candidatos = await calcularCandidatos(client, anoRef, mesRef);
    const eventos: CandidatoReajuste[] = [];
    const ignorados: { pc_id: number; motivo: string }[] = [];

    for (const c of candidatos) {
      if (!pcIdsSet.has(c.pc_id)) continue;
      if (c.status !== "aplicavel") {
        ignorados.push({ pc_id: c.pc_id, motivo: `status mudou para "${c.status}" antes da confirmação` });
        continue;
      }

      await client.query(
        `UPDATE precos_cliente SET
           pc_vlr_unit = COALESCE($1, pc_vlr_unit),
           pc_vlr_franquia = COALESCE($2, pc_vlr_franquia),
           pc_dat_ult_reajuste = $3
         WHERE pc_id = $4`,
        [c.vlr_unit_novo, c.vlr_franquia_novo, new Date().toISOString().slice(0, 10), c.pc_id]
      );
      await client.query(
        `INSERT INTO reajuste_eventos
           (pc_id, cliente_id, produto_id, reaj_data, reaj_index_nome, reaj_index_ano, reaj_index_mes,
            reaj_taxa_acum_12m, reaj_vlr_unit_ant, reaj_vlr_unit_novo, reaj_vlr_franquia_ant, reaj_vlr_franquia_novo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          c.pc_id,
          c.cliente_id,
          c.produto_id,
          new Date().toISOString().slice(0, 10),
          c.pc_cod_index,
          anoRef,
          mesRef,
          c.index_acum_12m,
          c.vlr_unit_atual,
          c.vlr_unit_novo,
          c.vlr_franquia_atual,
          c.vlr_franquia_novo,
        ]
      );
      eventos.push(c);
    }

    // pc_id pedido pelo frontend mas que nem aparece mais entre os candidatos do mês (ex.: mudou
    // pc_dat_niver por edição manual entre a simulação e a confirmação).
    const encontrados = new Set(candidatos.map((c) => c.pc_id));
    for (const id of pcIds) {
      if (!encontrados.has(id) && !ignorados.some((i) => i.pc_id === id)) {
        ignorados.push({ pc_id: id, motivo: "não está mais entre os contratos com aniversário no mês corrente" });
      }
    }

    return { eventos, ignorados };
  });

  res.json({ ok: true, anoRef, mesRef, aplicados: resultado.eventos.length, eventos: resultado.eventos, ignorados: resultado.ignorados });
});
