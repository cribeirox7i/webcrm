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

// token de sessão único gerado a cada boot do servidor -- login fica válido até o próximo restart do backend
export const SESSION_TOKEN = crypto.randomBytes(24).toString("hex");

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
