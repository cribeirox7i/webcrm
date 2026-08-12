import { Router } from "express";
import { catalog } from "../catalog";

export const metaRouter = Router();

// GET /api/_meta -- lista tabelas/views disponiveis e suas colunas (util pro frontend)
metaRouter.get("/_meta", (_req, res) => {
  res.json([...catalog.values()]);
});
