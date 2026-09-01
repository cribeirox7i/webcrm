import { Router } from "express";
import { query, withTransaction } from "../db";
import { generateProvisionalPassword, hashPassword } from "../authCrypto";
import { erroComplexidadeSenha, gerarEEnviarConvite } from "../convite";
import { redactRow } from "./resource";

export const usuariosRouter = Router();

// POST /api/usuarios -- sobrescreve o POST genérico do resource.ts: gera senha provisória
// (hash já, nunca fica em texto puro no banco) e devolve ela UMA vez pro admin que criou.
usuariosRouter.post("/", async (req, res) => {
  const { user_nome, user_mail, user_status } = (req.body ?? {}) as {
    user_nome?: unknown;
    user_mail?: unknown;
    user_status?: unknown;
  };
  if (typeof user_nome !== "string" || !user_nome.trim() || typeof user_mail !== "string" || !user_mail.trim()) {
    res.status(400).json({ error: "nome e e-mail são obrigatórios" });
    return;
  }

  // Checagem antecipada só pra devolver um erro amigável -- a garantia real contra
  // duplicidade (mesmo sob concorrência) é a coluna `user_mail` ser `citext` + UNIQUE no
  // Postgres (ver schema.pg.sql); se dois requests concorrentes passarem por aqui ao mesmo
  // tempo, o INSERT abaixo falha pra um deles com unique_violation, capturado no catch.
  const { rows: existentes } = await query("SELECT user_id FROM usuarios WHERE user_mail = $1", [user_mail.trim()]);
  if (existentes[0]) {
    res.status(400).json({ error: "já existe um usuário com esse e-mail" });
    return;
  }

  const senhaProvisoria = generateProvisionalPassword();
  try {
    const { rows } = await query(
      "INSERT INTO usuarios (user_nome, user_mail, user_status, user_senha_hash, user_deve_trocar_senha) VALUES ($1, $2, $3, $4, 1) RETURNING *",
      [user_nome.trim(), user_mail.trim(), typeof user_status === "string" ? user_status : "ATIVO", hashPassword(senhaProvisoria)]
    );
    res.status(201).json({ ...redactRow("usuarios", rows[0] as Record<string, unknown>), senhaProvisoria });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// POST /api/usuarios/:id/convite -- gera um novo link de convite e (se SMTP configurado) envia por e-mail
usuariosRouter.post("/:id/convite", async (req, res) => {
  const { rows } = await query<{ user_id: number; user_nome: string; user_mail: string }>(
    "SELECT user_id, user_nome, user_mail FROM usuarios WHERE user_id = $1",
    [req.params.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: "usuário não encontrado" });
    return;
  }

  const { enviado, link, expiraEm } = await gerarEEnviarConvite(rows[0]);
  res.json({ enviado, link, expiraEm });
});

// PUT /api/usuarios/:id/senha -- admin define uma senha direto pro usuário (sem passar
// pelo convite por e-mail). Revoga as sessões existentes do usuário e força troca no
// próximo login -- atômico (BEGIN/COMMIT), mesma garantia do self-service em auth.ts.
usuariosRouter.put("/:id/senha", async (req, res) => {
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

  const { rows } = await query<{ user_id: number }>("SELECT user_id FROM usuarios WHERE user_id = $1", [req.params.id]);
  const usuario = rows[0];
  if (!usuario) {
    res.status(404).json({ error: "usuário não encontrado" });
    return;
  }

  await withTransaction(async (client) => {
    await client.query("UPDATE usuarios SET user_senha_hash = $1, user_deve_trocar_senha = 1 WHERE user_id = $2", [
      hashPassword(novaSenha),
      usuario.user_id,
    ]);
    await client.query("DELETE FROM usuario_sessoes WHERE user_id = $1", [usuario.user_id]);
  });

  res.status(204).send();
});
