import { Request, Response, NextFunction } from "express";
import { query } from "./db";
import { generateToken } from "./authCrypto";
import { SESSION_TOKEN } from "./adminAuth";

const SESSION_TTL_DIAS = Number(process.env.SESSION_TTL_DIAS) || 5;

export interface UsuarioLogado {
  user_id: number;
  user_nome: string;
  user_mail: string;
  user_deve_trocar_senha: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createSession(userId: number): Promise<{ token: string; expiraEm: string }> {
  const token = generateToken();
  const criadoEm = nowIso();
  const expiraEm = new Date(Date.now() + SESSION_TTL_DIAS * 24 * 60 * 60 * 1000).toISOString();
  await query(
    "INSERT INTO usuario_sessoes (sessao_token, user_id, criado_em, expira_em) VALUES ($1, $2, $3, $4)",
    [token, userId, criadoEm, expiraEm]
  );
  return { token, expiraEm };
}

export async function deleteSession(token: string): Promise<void> {
  await query("DELETE FROM usuario_sessoes WHERE sessao_token = $1", [token]);
}

/** Sessão válida = existe, não expirou E o usuário ainda está ATIVO -- desabilitar um
 * usuário (usuarios.user_status) derruba o acesso dele já na próxima requisição, mesmo
 * que a linha em usuario_sessoes ainda não tenha expirado por tempo. */
export async function getUsuarioDaSessao(token: string): Promise<UsuarioLogado | null> {
  const { rows } = await query<UsuarioLogado & { user_status: string | null }>(
    `SELECT u.user_id, u.user_nome, u.user_mail, u.user_status, u.user_deve_trocar_senha
     FROM usuario_sessoes s
     JOIN usuarios u ON u.user_id = s.user_id
     WHERE s.sessao_token = $1 AND s.expira_em > $2`,
    [token, nowIso()]
  );

  const row = rows[0];
  if (!row || row.user_status !== "ATIVO") return null;
  return {
    user_id: row.user_id,
    user_nome: row.user_nome,
    user_mail: row.user_mail,
    user_deve_trocar_senha: row.user_deve_trocar_senha,
  };
}

declare module "express-serve-static-core" {
  interface Request {
    isAdmin?: boolean;
    usuario?: UsuarioLogado;
  }
}

/** Protege as rotas do app principal. Se `requireAdmin` já autenticou a requisição
 * (rota /api/usuarios ou /api/usuarios_permissoes_menu, via PIN mestre), deixa passar --
 * PIN de admin e login de usuário são mecanismos independentes, não precisa dos dois. */
export async function requireUserAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.isAdmin) {
    next();
    return;
  }

  const auth = req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const usuario = token ? await getUsuarioDaSessao(token) : null;
  if (!usuario) {
    res.status(401).json({ error: "não autenticado" });
    return;
  }
  req.usuario = usuario;
  next();
}

/** Aceita tanto o PIN mestre (token de admin) quanto uma sessão de usuário válida --
 * usado em recursos acessíveis tanto pelo app principal quanto pela tela de Admin (ex.:
 * cart_mes, que tem CRUD tanto em Financeiro quanto no Admin). Precisa ser montada ANTES
 * do requireUserAuth genérico pra interceptar o token de admin, que senão seria tratado
 * como um token de sessão de usuário inválido. */
export async function requireUserOrAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token === SESSION_TOKEN) {
    req.isAdmin = true;
    next();
    return;
  }
  await requireUserAuth(req, res, next);
}
