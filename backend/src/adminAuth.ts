import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";

const configuredPin = process.env.ADMIN_PIN;
const pinIsValid = !!configuredPin && configuredPin.length >= 6;

export const ADMIN_PIN = pinIsValid ? (configuredPin as string) : crypto.randomBytes(6).toString("hex");

if (!configuredPin) {
  console.log(`[admin] ADMIN_PIN não definido no ambiente -- PIN gerado só para esta execução: ${ADMIN_PIN}`);
  console.log("[admin] defina a variável de ambiente ADMIN_PIN (mín. 6 caracteres) pra fixar um PIN permanente.");
} else if (!pinIsValid) {
  console.log(`[admin] ADMIN_PIN configurado é curto demais (mín. 6 caracteres) -- ignorado. PIN temporário: ${ADMIN_PIN}`);
}

// Token determinístico a partir do ADMIN_PIN (env var, compartilhada por todas as instâncias),
// não um random gerado no boot do módulo -- em serverless (Vercel) cada instância/cold start
// reexecuta este arquivo, então um token aleatório por instância fazia requisições paralelas
// (ex.: "Marcar todas as permissões", ~15 chamadas de uma vez) caírem em instâncias diferentes
// com tokens diferentes, devolvendo 401 "não autenticado" pra algumas e derrubando a sessão do
// admin no frontend. Com o mesmo ADMIN_PIN, toda instância calcula o mesmo SESSION_TOKEN.
export const SESSION_TOKEN = crypto.createHash("sha256").update(`webcrm-admin-session:${ADMIN_PIN}`).digest("hex");

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== SESSION_TOKEN) {
    res.status(401).json({ error: "não autenticado" });
    return;
  }
  req.isAdmin = true;
  next();
}
