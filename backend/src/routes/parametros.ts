import { Router } from "express";
import { query } from "../db";
import { requireAdmin, SESSION_TOKEN, segredoConfere } from "../adminAuth";
import { getUsuarioDaSessao } from "../mainAuth";

// parametros_gerais precisa ser lido tanto pela tela de Admin (PIN mestre, sem sessão de
// usuário -- main.tsx não monta AuthProvider na rota /admin) quanto pelo app principal
// (sessão de usuário comum, pra mostrar a logo na Sidebar) -- por isso o GET aqui aceita
// os dois tipos de token, em vez de depender só do requireUserAuth genérico (que rejeitaria
// o token do PIN, já que req.isAdmin só é setado quando requireAdmin roda antes dele).
export const parametrosRouter = Router();

parametrosRouter.get("/parametros_gerais/1", async (req, res) => {
  const auth = req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const isAdmin = !!token && segredoConfere(token, SESSION_TOKEN);
  const usuario = !isAdmin && token ? await getUsuarioDaSessao(token) : null;
  if (!isAdmin && !usuario) {
    res.status(401).json({ error: "não autenticado" });
    return;
  }
  const { rows } = await query("SELECT * FROM parametros_gerais WHERE param_id = 1");
  res.json(rows[0]);
});

// PUT exige o PIN mestre -- só o admin pode alterar a marca do sistema.
parametrosRouter.put("/parametros_gerais/1", requireAdmin, async (req, res) => {
  const { param_logo_escuro_url, param_logo_claro_url } = (req.body ?? {}) as {
    param_logo_escuro_url?: unknown;
    param_logo_claro_url?: unknown;
  };
  const { rows } = await query(
    "UPDATE parametros_gerais SET param_logo_escuro_url = $1, param_logo_claro_url = $2 WHERE param_id = 1 RETURNING *",
    [
      typeof param_logo_escuro_url === "string" ? param_logo_escuro_url.trim() || null : null,
      typeof param_logo_claro_url === "string" ? param_logo_claro_url.trim() || null : null,
    ]
  );
  res.json(rows[0]);
});
