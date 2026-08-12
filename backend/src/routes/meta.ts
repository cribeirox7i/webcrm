import { Router } from "express";
import { catalog, ensureCatalogLoaded } from "../catalog";

export const metaRouter = Router();

// GET /api/_meta -- lista tabelas/views disponiveis e suas colunas (util pro frontend)
metaRouter.get("/_meta", async (_req, res) => {
  await ensureCatalogLoaded();
  res.json([...catalog.values()]);
});
