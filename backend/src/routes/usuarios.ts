import { Router } from "express";
import { db } from "../db";
import { generateProvisionalPassword, hashPassword } from "../authCrypto";
import { gerarEEnviarConvite, MIN_SENHA_LEN } from "../convite";
import { redactRow } from "./resource";

export const usuariosRouter = Router();

// POST /api/usuarios -- sobrescreve o POST genérico do resource.ts: gera senha provisória
// (hash já, nunca fica em texto puro no banco) e devolve ela UMA vez pro admin que criou.
usuariosRouter.post("/", (req, res) => {
  const { user_nome, user_mail, user_status } = (req.body ?? {}) as {
    user_nome?: unknown;
    user_mail?: unknown;
    user_status?: unknown;
  };
  if (typeof user_nome !== "string" || !user_nome.trim() || typeof user_mail !== "string" || !user_mail.trim()) {
    res.status(400).json({ error: "nome e e-mail são obrigatórios" });
    return;
  }

  // O UNIQUE de user_mail no SQLite é case-sensitive, mas o login agora busca com
  // COLLATE NOCASE -- sem esta checagem daria pra cadastrar "Fulano@x.com" e
  // "fulano@x.com" como usuários distintos e o login viraria uma loteria entre os dois.
  const jaExiste = db
    .prepare("SELECT user_id FROM usuarios WHERE user_mail = ? COLLATE NOCASE")
    .get(user_mail.trim());
  if (jaExiste) {
    res.status(400).json({ error: "já existe um usuário com esse e-mail" });
    return;
  }

  const senhaProvisoria = generateProvisionalPassword();
  try {
    const result = db
      .prepare(
        "INSERT INTO usuarios (user_nome, user_mail, user_status, user_senha_hash, user_deve_trocar_senha) VALUES (?, ?, ?, ?, 1)"
      )
      .run(user_nome.trim(), user_mail.trim(), typeof user_status === "string" ? user_status : "ATIVO", hashPassword(senhaProvisoria));

    const row = db.prepare("SELECT * FROM usuarios WHERE user_id = ?").get(result.lastInsertRowid) as Record<
      string,
      unknown
    >;
    res.status(201).json({ ...redactRow("usuarios", row), senhaProvisoria });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// POST /api/usuarios/:id/convite -- gera um novo link de convite e (se SMTP configurado) envia por e-mail
usuariosRouter.post("/:id/convite", async (req, res) => {
  const usuario = db.prepare("SELECT user_id, user_nome, user_mail FROM usuarios WHERE user_id = ?").get(req.params.id) as
    | { user_id: number; user_nome: string; user_mail: string }
    | undefined;
  if (!usuario) {
    res.status(404).json({ error: "usuário não encontrado" });
    return;
  }

  const { enviado, link, expiraEm } = await gerarEEnviarConvite(usuario);
  res.json({ enviado, link, expiraEm });
});

// PUT /api/usuarios/:id/senha -- admin define uma senha direto pro usuário (sem passar
// pelo convite por e-mail) -- útil pra testar/ajudar alguém sem acesso à própria caixa de
// entrada no momento. Revoga as sessões existentes do usuário (uma senha nova deveria
// invalidar qualquer sessão aberta antes da troca, mesma lógica de "trocar senha" comum).
// Também força troca no próximo login (user_deve_trocar_senha=1) -- essa senha foi definida
// pelo admin, não pelo dono da conta, mesma garantia que já existe no fluxo de convite.
usuariosRouter.put("/:id/senha", (req, res) => {
  const { novaSenha } = (req.body ?? {}) as { novaSenha?: unknown };
  if (typeof novaSenha !== "string" || novaSenha.length < MIN_SENHA_LEN) {
    res.status(400).json({ error: `senha (mín. ${MIN_SENHA_LEN} caracteres) é obrigatória` });
    return;
  }

  const usuario = db.prepare("SELECT user_id FROM usuarios WHERE user_id = ?").get(req.params.id) as
    | { user_id: number }
    | undefined;
  if (!usuario) {
    res.status(404).json({ error: "usuário não encontrado" });
    return;
  }

  db.prepare("UPDATE usuarios SET user_senha_hash = ?, user_deve_trocar_senha = 1 WHERE user_id = ?").run(
    hashPassword(novaSenha),
    usuario.user_id
  );
  db.prepare("DELETE FROM usuario_sessoes WHERE user_id = ?").run(usuario.user_id);
  res.status(204).send();
});
