import { Router } from "express";
import { db } from "../db";
import { requireAdmin, SESSION_TOKEN } from "../adminAuth";
import { getUsuarioDaSessao } from "../mainAuth";

// parametros_gerais precisa ser lido tanto pela tela de Admin (PIN mestre, sem sessão de
// usuário -- main.tsx não monta AuthProvider na rota /admin) quanto pelo app principal
// (sessão de usuário comum, pra mostrar a logo na Sidebar) -- por isso o GET aqui aceita
// os dois tipos de token, em vez de depender só do requireUserAuth genérico (que rejeitaria
// o token do PIN, já que req.isAdmin só é setado quando requireAdmin roda antes dele).
export const parametrosRouter = Router();

parametrosRouter.get("/parametros_gerais/1", (req, res) => {
  const auth = req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const isAdmin = token === SESSION_TOKEN;
  const usuario = !isAdmin && token ? getUsuarioDaSessao(token) : null;
  if (!isAdmin && !usuario) {
    res.status(401).json({ error: "não autenticado" });
    return;
  }
  const row = db.prepare("SELECT * FROM parametros_gerais WHERE param_id = 1").get();
  res.json(row);
});

// PUT exige o PIN mestre -- só o admin pode alterar a marca do sistema.
parametrosRouter.put("/parametros_gerais/1", requireAdmin, (req, res) => {
  const { param_logo_escuro_url, param_logo_claro_url } = (req.body ?? {}) as {
    param_logo_escuro_url?: unknown;
    param_logo_claro_url?: unknown;
  };
  db.prepare("UPDATE parametros_gerais SET param_logo_escuro_url = ?, param_logo_claro_url = ? WHERE param_id = 1").run(
    typeof param_logo_escuro_url === "string" ? param_logo_escuro_url.trim() || null : null,
    typeof param_logo_claro_url === "string" ? param_logo_claro_url.trim() || null : null
  );
  const row = db.prepare("SELECT * FROM parametros_gerais WHERE param_id = 1").get();
  res.json(row);
});
