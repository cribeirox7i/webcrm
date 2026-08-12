import { Router } from "express";
import { db } from "../db";

// usuarios_permissoes_menu tem PK composta (user_id, menu_key) -- as rotas genéricas de
// resource.ts (PUT/DELETE /:resource/:id) só sabem lidar com PK de 1 coluna, então essa
// tabela precisa de uma rota dedicada. GET (listar por user_id) já funciona via resource.ts.
export const permissoesRouter = Router();

permissoesRouter.put("/usuarios_permissoes_menu/:userId/:menuKey", (req, res) => {
  const { userId, menuKey } = req.params;
  const { perm_leitura, perm_insercao, perm_edicao, perm_exclusao } = (req.body ?? {}) as Record<string, unknown>;

  db.prepare(
    `INSERT INTO usuarios_permissoes_menu (user_id, menu_key, perm_leitura, perm_insercao, perm_edicao, perm_exclusao)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, menu_key) DO UPDATE SET
       perm_leitura = excluded.perm_leitura,
       perm_insercao = excluded.perm_insercao,
       perm_edicao = excluded.perm_edicao,
       perm_exclusao = excluded.perm_exclusao`
  ).run(userId, menuKey, perm_leitura ? 1 : 0, perm_insercao ? 1 : 0, perm_edicao ? 1 : 0, perm_exclusao ? 1 : 0);

  const row = db
    .prepare(`SELECT * FROM usuarios_permissoes_menu WHERE user_id = ? AND menu_key = ?`)
    .get(userId, menuKey);
  res.json(row);
});
