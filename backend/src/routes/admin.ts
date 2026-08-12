import { Router } from "express";
import { ADMIN_PIN, SESSION_TOKEN } from "../adminAuth";
import { adminLoginRateLimiter } from "../rateLimit";

export const adminRouter = Router();

// POST /api/admin/login -- compara com o PIN mestre (ADMIN_PIN); sem vínculo com um usuário específico
adminRouter.post("/login", adminLoginRateLimiter, (req, res) => {
  const { pin } = (req.body ?? {}) as { pin?: unknown };
  if (typeof pin !== "string" || pin !== ADMIN_PIN) {
    res.status(401).json({ error: "PIN inválido" });
    return;
  }
  res.json({ token: SESSION_TOKEN });
});
