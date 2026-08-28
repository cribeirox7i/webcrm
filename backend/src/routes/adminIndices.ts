import { Router } from "express";
import { withTransaction } from "../db";
import { buscarIndicesBcb } from "../indicesBcb";

// POST /api/admin/indices/sync -- puxa os índices do Banco Central (SGS) e faz upsert em
// indices_economicos. Montado sob requireAdmin (server.ts) -- só o PIN mestre do Admin dispara.
export const adminIndicesRouter = Router();

interface ResumoIndice {
  nome: string;
  serie: number;
  mesesGravados: number;
  ultimoMes: string | null; // "AAAA-MM"
  ultimoValor: number | null;
}

adminIndicesRouter.post("/sync", async (_req, res) => {
  let series;
  try {
    series = await buscarIndicesBcb();
  } catch (err) {
    console.error("[adminIndices] falha ao buscar no Banco Central:", err);
    res.status(502).json({ error: `não foi possível buscar os índices no Banco Central: ${(err as Error).message}` });
    return;
  }

  const resumo: ResumoIndice[] = await withTransaction(async (client) => {
    const out: ResumoIndice[] = [];
    for (const s of series) {
      let gravados = 0;
      for (const m of s.meses) {
        await client.query(
          `INSERT INTO indices_economicos (index_nome, index_ano, index_mes, index_vlr, index_cod)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (index_nome, index_ano, index_mes) DO UPDATE SET
             index_vlr = excluded.index_vlr,
             index_cod = excluded.index_cod`,
          [s.nome, m.ano, m.mes, m.vlr, s.serie]
        );
        gravados++;
      }
      const ultimo = [...s.meses].sort((a, b) => a.ano - b.ano || a.mes - b.mes).at(-1) ?? null;
      out.push({
        nome: s.nome,
        serie: s.serie,
        mesesGravados: gravados,
        ultimoMes: ultimo ? `${ultimo.ano}-${String(ultimo.mes).padStart(2, "0")}` : null,
        ultimoValor: ultimo ? ultimo.vlr : null,
      });
    }
    return out;
  });

  res.json({ ok: true, fonte: "Banco Central do Brasil (SGS)", atualizadoEm: new Date().toISOString(), indices: resumo });
});
