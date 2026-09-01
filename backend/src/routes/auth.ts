import { Router } from "express";
import { query, withTransaction } from "../db";
import { hashPassword, verifyPassword } from "../authCrypto";
import { createSession, deleteSession, requireUserAuth } from "../mainAuth";
import { erroComplexidadeSenha, gerarEEnviarConvite } from "../convite";
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
authRouter.post("/login", loginRateLimiter, async (req, res) => {
  const { email, senha } = (req.body ?? {}) as { email?: unknown; senha?: unknown };
  if (typeof email !== "string" || typeof senha !== "string") {
    res.status(400).json({ error: "e-mail e senha são obrigatórios" });
    return;
  }

  // user_mail é `citext` no Postgres (comparação já case-insensitive nativamente) --
  // substitui o `COLLATE NOCASE` que existia na versão SQLite. Ver schema.pg.sql.
  const { rows } = await query<UsuarioRow>(
    "SELECT user_id, user_nome, user_mail, user_status, user_senha_hash, user_deve_trocar_senha FROM usuarios WHERE user_mail = $1",
    [email.trim()]
  );
  const usuario = rows[0];

  if (!usuario || usuario.user_status !== "ATIVO" || !verifyPassword(senha, usuario.user_senha_hash)) {
    res.status(401).json({ error: "e-mail ou senha inválidos" });
    return;
  }

  const { token, expiraEm } = await createSession(usuario.user_id);
  res.json({
    token,
    expiraEm,
    mustChangePassword: !!usuario.user_deve_trocar_senha,
    usuario: { id: usuario.user_id, nome: usuario.user_nome, email: usuario.user_mail },
  });
});

// POST /api/auth/logout
authRouter.post("/logout", requireUserAuth, async (req, res) => {
  const auth = req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token) await deleteSession(token);
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
authRouter.get("/minhas-permissoes", requireUserAuth, async (req, res) => {
  const { rows } = await query(
    "SELECT menu_key, perm_leitura, perm_insercao, perm_edicao, perm_exclusao FROM usuarios_permissoes_menu WHERE user_id = $1",
    [req.usuario!.user_id]
  );
  res.json(rows);
});

// POST /api/auth/trocar-senha -- exige a sessão atual (mesmo com troca pendente)
authRouter.post("/trocar-senha", requireUserAuth, async (req, res) => {
  const { senhaAtual, novaSenha } = (req.body ?? {}) as { senhaAtual?: unknown; novaSenha?: unknown };
  if (typeof senhaAtual !== "string" || typeof novaSenha !== "string") {
    res.status(400).json({ error: "senha atual e nova senha são obrigatórias" });
    return;
  }
  const erroSenha = erroComplexidadeSenha(novaSenha);
  if (erroSenha) {
    res.status(400).json({ error: erroSenha });
    return;
  }

  const { rows } = await query<{ user_senha_hash: string | null }>(
    "SELECT user_senha_hash FROM usuarios WHERE user_id = $1",
    [req.usuario!.user_id]
  );
  if (!rows[0] || !verifyPassword(senhaAtual, rows[0].user_senha_hash)) {
    res.status(401).json({ error: "senha atual incorreta" });
    return;
  }

  // Revoga qualquer OUTRA sessão aberta desse usuário (ex.: um token antigo que tenha
  // vazado) -- mantém a sessão ATUAL viva. Atômico (BEGIN/COMMIT): sem isso, se o UPDATE
  // da senha for bem-sucedido mas o DELETE das sessões falhar, um token vazado continuaria
  // válido mesmo com a senha já trocada.
  const authHeader = req.header("authorization") ?? "";
  const tokenAtual = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  await withTransaction(async (client) => {
    await client.query("UPDATE usuarios SET user_senha_hash = $1, user_deve_trocar_senha = 0 WHERE user_id = $2", [
      hashPassword(novaSenha),
      req.usuario!.user_id,
    ]);
    await client.query("DELETE FROM usuario_sessoes WHERE user_id = $1 AND sessao_token != $2", [
      req.usuario!.user_id,
      tokenAtual,
    ]);
  });

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

  const { rows } = await query<{ user_id: number; user_nome: string; user_mail: string }>(
    "SELECT user_id, user_nome, user_mail FROM usuarios WHERE user_mail = $1 AND user_status = 'ATIVO'",
    [email.trim()]
  );

  if (rows[0]) {
    await gerarEEnviarConvite(rows[0]).catch(() => {}); // best-effort -- não deixa a falha de e-mail vazar pra resposta
  }

  res.json({ ok: true });
});

// GET /api/auth/convite/:token -- valida o link de convite antes de mostrar a tela "definir senha"
authRouter.get("/convite/:token", async (req, res) => {
  const { rows } = await query<{ user_nome: string; user_mail: string; user_convite_expira_em: string }>(
    "SELECT user_nome, user_mail, user_convite_expira_em FROM usuarios WHERE user_convite_token = $1",
    [req.params.token]
  );
  const row = rows[0];

  if (!row || row.user_convite_expira_em < nowIso()) {
    res.status(404).json({ error: "convite inválido ou expirado" });
    return;
  }
  res.json({ nome: row.user_nome, email: row.user_mail });
});

// POST /api/auth/convite/:token/definir-senha -- define a senha real e já loga o usuário
authRouter.post("/convite/:token/definir-senha", async (req, res) => {
  const { novaSenha } = (req.body ?? {}) as { novaSenha?: unknown };
  if (typeof novaSenha !== "string") {
    res.status(400).json({ error: "senha é obrigatória" });
    return;
  }
  const erroSenha = erroComplexidadeSenha(novaSenha);
  if (erroSenha) {
    res.status(400).json({ error: erroSenha });
    return;
  }

  const { rows } = await query<{
    user_id: number;
    user_nome: string;
    user_mail: string;
    user_status: string | null;
    user_convite_expira_em: string;
  }>(
    "SELECT user_id, user_nome, user_mail, user_status, user_convite_expira_em FROM usuarios WHERE user_convite_token = $1",
    [req.params.token]
  );
  const row = rows[0];

  if (!row || row.user_convite_expira_em < nowIso()) {
    res.status(404).json({ error: "convite inválido ou expirado" });
    return;
  }
  if (row.user_status !== "ATIVO") {
    res.status(403).json({ error: "usuário desativado -- fale com o administrador" });
    return;
  }

  await query(
    "UPDATE usuarios SET user_senha_hash = $1, user_deve_trocar_senha = 0, user_convite_token = NULL, user_convite_expira_em = NULL WHERE user_id = $2",
    [hashPassword(novaSenha), row.user_id]
  );

  const { token, expiraEm } = await createSession(row.user_id);
  res.json({
    token,
    expiraEm,
    mustChangePassword: false,
    usuario: { id: row.user_id, nome: row.user_nome, email: row.user_mail },
  });
});
