import { Router, Request, Response, NextFunction } from "express";
import { catalog, ensureCatalogLoaded } from "../catalog";

export const metaRouter = Router();

// Só o PIN mestre: o catálogo lista TODA tabela/view do schema com todos os nomes de coluna
// (inclusive `usuarios`, com `user_senha_hash`/`user_convite_token`). É só metadado, nenhum dado
// real, mas antes qualquer usuário autenticado lia isso -- reconhecimento de graça pra quem já
// tem uma conta. Único consumidor é a tela de Admin (`adminClient.ts`, token do PIN), então
// restringir aqui não tira nada do app principal. `req.isAdmin` é setado pelo requireAdmin
// montado em server.ts antes deste router.
function somenteAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAdmin) {
    res.status(403).json({ error: "sem permissão para esta ação" });
    return;
  }
  next();
}

// GET /api/_meta -- lista tabelas/views disponiveis e suas colunas (usado pela tela de Admin)
metaRouter.get("/_meta", somenteAdmin, async (_req, res) => {
  await ensureCatalogLoaded();
  res.json([...catalog.values()]);
});
