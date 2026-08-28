import { Router } from "express";
import { query } from "../db";
import { enforceMenuPermission } from "../permissaoResource";

// indices_economicos tem PK composta (index_nome, index_ano, index_mes) -- o resourceRouter
// genérico (PUT/DELETE /:resource/:id) só sabe lidar com PK de 1 coluna, então catalog.ts dá
// pk: null pra essa tabela e ela precisa de rota dedicada, mesmo padrão de routes/permissoes.ts.
// GET (lista) já funciona pela view indices_calculados via resourceRouter.
export const indicesRouter = Router();

const RESOURCE = () => "indices_economicos";

function parsePkParams(nome: string, ano: string, mes: string): { nome: string; ano: number; mes: number } | string {
  const n = nome.trim();
  const a = Number(ano);
  const m = Number(mes);
  if (!n) return "índice sem nome";
  if (!Number.isInteger(a) || a < 1994 || a > 2100) return "ano inválido";
  if (!Number.isInteger(m) || m < 1 || m > 12) return "mês inválido (esperado 1 a 12)";
  return { nome: n, ano: a, mes: m };
}

// PUT /api/indices_economicos/:nome/:ano/:mes -- upsert (cria ou atualiza o valor do mês)
indicesRouter.put(
  "/indices_economicos/:nome/:ano/:mes",
  enforceMenuPermission("perm_edicao", RESOURCE),
  async (req, res) => {
    const pk = parsePkParams(req.params.nome, req.params.ano, req.params.mes);
    if (typeof pk === "string") {
      res.status(400).json({ error: pk });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const vlrRaw = body.index_vlr;
    const vlr = vlrRaw === null || vlrRaw === undefined || vlrRaw === "" ? null : Number(vlrRaw);
    if (vlr !== null && !Number.isFinite(vlr)) {
      res.status(400).json({ error: "index_vlr: valor inválido (esperado número)" });
      return;
    }
    const codRaw = body.index_cod;
    const cod = codRaw === null || codRaw === undefined || codRaw === "" ? null : Number(codRaw);
    if (cod !== null && !Number.isInteger(cod)) {
      res.status(400).json({ error: "index_cod: valor inválido (esperado inteiro)" });
      return;
    }

    const { rows } = await query(
      `INSERT INTO indices_economicos (index_nome, index_ano, index_mes, index_vlr, index_cod)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (index_nome, index_ano, index_mes) DO UPDATE SET
         index_vlr = excluded.index_vlr,
         index_cod = COALESCE(excluded.index_cod, indices_economicos.index_cod)
       RETURNING *`,
      [pk.nome, pk.ano, pk.mes, vlr, cod]
    );
    res.json(rows[0]);
  }
);

// DELETE /api/indices_economicos/:nome/:ano/:mes
indicesRouter.delete(
  "/indices_economicos/:nome/:ano/:mes",
  enforceMenuPermission("perm_exclusao", RESOURCE),
  async (req, res) => {
    const pk = parsePkParams(req.params.nome, req.params.ano, req.params.mes);
    if (typeof pk === "string") {
      res.status(400).json({ error: pk });
      return;
    }
    const { rowCount } = await query(
      `DELETE FROM indices_economicos WHERE index_nome = $1 AND index_ano = $2 AND index_mes = $3`,
      [pk.nome, pk.ano, pk.mes]
    );
    if (rowCount === 0) {
      res.status(404).json({ error: "registro não encontrado" });
      return;
    }
    res.status(204).send();
  }
);
