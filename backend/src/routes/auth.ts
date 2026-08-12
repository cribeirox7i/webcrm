import { Router } from "express";
import { db } from "../db";
import { hashPassword, verifyPassword } from "../authCrypto";
import { createSession, deleteSession, requireUserAuth } from "../mainAuth";
import { gerarEEnviarConvite, MIN_SENHA_LEN } from "../convite";
import { loginRateLimiter, esqueciSenhaRateLimiter } from "../rateLimit";

export const authRouter = Router();

interface UsuarioRow {
  user_id: number;
  user_nome: string;
  user_mail: string;
  user_status: string | null;
  user_senha_hash: string | null;
  user_deve_trocar_senha: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

// POST /api/auth/login -- e-mail + senha do usuário (nada a ver com o PIN mestre do /admin)
authRouter.post("/login", loginRateLimiter, (req, res) => {
  const { email, senha } = (req.body ?? {}) as { email?: unknown; senha?: unknown };
  if (typeof email !== "string" || typeof senha !== "string") {
    res.status(400).json({ error: "e-mail e senha são obrigatórios" });
    return;
  }

  // COLLATE NOCASE: e-mail não diferencia maiúscula/minúscula na prática (o domínio nunca
  // diferencia, e nenhum provedor real trata a parte local como case-sensitive). Sem isso,
  // digitar "Fulano@empresa.com" quando o cadastro tem "fulano@empresa.com" caía no mesmo
  // 401 de senha errada -- e como a mensagem é genérica ("e-mail ou senha inválidos", de
  // propósito, pra não revelar quais e-mails existem), parecia que a senha recém-trocada
  // não tinha sido salva. Bug real reportado pelo usuário em 2026-08-11.
  const usuario = db
    .prepare(
      "SELECT user_id, user_nome, user_mail, user_status, user_senha_hash, user_deve_trocar_senha FROM usuarios WHERE user_mail = ? COLLATE NOCASE"
    )
    .get(email.trim()) as UsuarioRow | undefined;

  if (!usuario || usuario.user_status !== "ATIVO" || !verifyPassword(senha, usuario.user_senha_hash)) {
    res.status(401).json({ error: "e-mail ou senha inválidos" });
    return;
  }

  const { token, expiraEm } = createSession(usuario.user_id);
  res.json({
    token,
    expiraEm,
    mustChangePassword: !!usuario.user_deve_trocar_senha,
    usuario: { id: usuario.user_id, nome: usuario.user_nome, email: usuario.user_mail },
  });
});

// POST /api/auth/logout
authRouter.post("/logout", requireUserAuth, (req, res) => {
  const auth = req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token) deleteSession(token);
  res.status(204).send();
});

// GET /api/auth/me
authRouter.get("/me", requireUserAuth, (req, res) => {
  const u = req.usuario!;
  res.json({
    usuario: { id: u.user_id, nome: u.user_nome, email: u.user_mail },
    mustChangePassword: !!u.user_deve_trocar_senha,
  });
});

// GET /api/auth/minhas-permissoes -- self-service (não exige PIN de admin, só sessão
// própria) pra Sidebar saber quais menus esconder. Menu sem nenhuma das 4 flags marcadas
// simplesmente não aparece aqui (o front trata "ausente" = oculto).
authRouter.get("/minhas-permissoes", requireUserAuth, (req, res) => {
  const rows = db
    .prepare(
      "SELECT menu_key, perm_leitura, perm_insercao, perm_edicao, perm_exclusao FROM usuarios_permissoes_menu WHERE user_id = ?"
    )
    .all(req.usuario!.user_id);
  res.json(rows);
});

// POST /api/auth/trocar-senha -- exige a sessão atual (mesmo com troca pendente)
authRouter.post("/trocar-senha", requireUserAuth, (req, res) => {
  const { senhaAtual, novaSenha } = (req.body ?? {}) as { senhaAtual?: unknown; novaSenha?: unknown };
  if (typeof senhaAtual !== "string" || typeof novaSenha !== "string" || novaSenha.length < MIN_SENHA_LEN) {
    res.status(400).json({ error: `senha atual e nova senha (mín. ${MIN_SENHA_LEN} caracteres) são obrigatórias` });
    return;
  }

  const row = db.prepare("SELECT user_senha_hash FROM usuarios WHERE user_id = ?").get(req.usuario!.user_id) as
    | { user_senha_hash: string | null }
    | undefined;
  if (!row || !verifyPassword(senhaAtual, row.user_senha_hash)) {
    res.status(401).json({ error: "senha atual incorreta" });
    return;
  }

  db.prepare("UPDATE usuarios SET user_senha_hash = ?, user_deve_trocar_senha = 0 WHERE user_id = ?").run(
    hashPassword(novaSenha),
    req.usuario!.user_id
  );

  // Revoga qualquer OUTRA sessão aberta desse usuário (ex.: um token antigo que tenha
  // vazado) -- só o reset feito pelo admin (PUT /api/usuarios/:id/senha) fazia isso antes;
  // trocar a própria senha devia ter a mesma garantia. Mantém a sessão ATUAL viva (não
  // desloga a pessoa na hora que ela mesma acabou de trocar a senha).
  const authHeader = req.header("authorization") ?? "";
  const tokenAtual = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  db.prepare("DELETE FROM usuario_sessoes WHERE user_id = ? AND sessao_token != ?").run(
    req.usuario!.user_id,
    tokenAtual
  );

  res.status(204).send();
});

// POST /api/auth/esqueci-senha -- self-service, gera o mesmo tipo de convite que o admin
// dispararia manualmente. Resposta é SEMPRE genérica (não revela se o e-mail existe ou
// não no sistema -- evita que alguém use esse endpoint pra descobrir e-mails cadastrados).
authRouter.post("/esqueci-senha", esqueciSenhaRateLimiter, async (req, res) => {
  const { email } = (req.body ?? {}) as { email?: unknown };
  if (typeof email !== "string" || !email.trim()) {
    res.status(400).json({ error: "e-mail é obrigatório" });
    return;
  }

  // mesma regra de caixa do login (ver comentário em POST /login) -- senão "Esqueci minha
  // senha" com o e-mail digitado em outra caixa não acha o usuário e, como a resposta é
  // sempre genérica, o link simplesmente nunca chega e não há erro visível.
  const usuario = db
    .prepare("SELECT user_id, user_nome, user_mail FROM usuarios WHERE user_mail = ? COLLATE NOCASE AND user_status = 'ATIVO'")
    .get(email.trim()) as { user_id: number; user_nome: string; user_mail: string } | undefined;

  if (usuario) {
    await gerarEEnviarConvite(usuario).catch(() => {}); // best-effort -- não deixa a falha de e-mail vazar pra resposta
  }

  res.json({ ok: true });
});

// GET /api/auth/convite/:token -- valida o link de convite antes de mostrar a tela "definir senha"
authRouter.get("/convite/:token", (req, res) => {
  const row = db
    .prepare("SELECT user_nome, user_mail, user_convite_expira_em FROM usuarios WHERE user_convite_token = ?")
    .get(req.params.token) as { user_nome: string; user_mail: string; user_convite_expira_em: string } | undefined;

  if (!row || row.user_convite_expira_em < nowIso()) {
    res.status(404).json({ error: "convite inválido ou expirado" });
    return;
  }
  res.json({ nome: row.user_nome, email: row.user_mail });
});

// POST /api/auth/convite/:token/definir-senha -- define a senha real e já loga o usuário
authRouter.post("/convite/:token/definir-senha", (req, res) => {
  const { novaSenha } = (req.body ?? {}) as { novaSenha?: unknown };
  if (typeof novaSenha !== "string" || novaSenha.length < MIN_SENHA_LEN) {
    res.status(400).json({ error: `senha (mín. ${MIN_SENHA_LEN} caracteres) é obrigatória` });
    return;
  }

  const row = db
    .prepare("SELECT user_id, user_nome, user_mail, user_status, user_convite_expira_em FROM usuarios WHERE user_convite_token = ?")
    .get(req.params.token) as
    | { user_id: number; user_nome: string; user_mail: string; user_status: string | null; user_convite_expira_em: string }
    | undefined;

  if (!row || row.user_convite_expira_em < nowIso()) {
    res.status(404).json({ error: "convite inválido ou expirado" });
    return;
  }
  if (row.user_status !== "ATIVO") {
    res.status(403).json({ error: "usuário desativado -- fale com o administrador" });
    return;
  }

  db.prepare(
    "UPDATE usuarios SET user_senha_hash = ?, user_deve_trocar_senha = 0, user_convite_token = NULL, user_convite_expira_em = NULL WHERE user_id = ?"
  ).run(hashPassword(novaSenha), row.user_id);

  const { token, expiraEm } = createSession(row.user_id);
  res.json({
    token,
    expiraEm,
    mustChangePassword: false,
    usuario: { id: row.user_id, nome: row.user_nome, email: row.user_mail },
  });
});
