import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { query } from "../db";
import { contentTypeSeguro, deleteObject, erroTipoArquivo, getSignedDownloadUrl, isStorageConfigured, uploadBuffer } from "../storage";
import { getPastaStorage } from "./parametrosStorage";
import { bloqueado } from "../permissaoResource";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 150);
}

interface PropostaRow {
  proposta_id: number;
  proposta_anexo: string | null;
}

// Anexo de proposta é um único arquivo por linha (coluna proposta_anexo), diferente do
// padrão de Fornecedores/Clientes que usa a tabela anexos (N anexos por entidade) --
// mesma infra de storage (routes/storage.ts), rotas dedicadas por já existir a coluna.
export const propostaAnexoRouter = Router();

propostaAnexoRouter.post("/propostas/:id/anexo", upload.single("file"), async (req, res) => {
  if (!isStorageConfigured()) {
    res.status(400).json({ error: "Armazenamento de arquivos não configurado (variáveis SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no backend)" });
    return;
  }
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "arquivo não enviado" });
    return;
  }
  const erroTipo = erroTipoArquivo(file.originalname, file.mimetype ?? "");
  if (erroTipo) {
    res.status(400).json({ error: erroTipo });
    return;
  }
  const { rows } = await query<PropostaRow>("SELECT proposta_id, proposta_anexo FROM propostas WHERE proposta_id = $1", [
    req.params.id,
  ]);
  const proposta = rows[0];
  if (!proposta) {
    res.status(404).json({ error: "proposta não encontrada" });
    return;
  }
  if (await bloqueado(req, res, "propostas", "perm_edicao")) return;

  const pasta = await getPastaStorage("propostas");
  const objectPath = `${pasta}/${proposta.proposta_id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${sanitizeFilename(
    file.originalname
  )}`;

  try {
    await uploadBuffer(objectPath, file.buffer, contentTypeSeguro());
    if (proposta.proposta_anexo && !/^https?:\/\//i.test(proposta.proposta_anexo)) {
      await deleteObject(proposta.proposta_anexo);
    }
    const { rows: updated } = await query(
      "UPDATE propostas SET proposta_anexo = $1 WHERE proposta_id = $2 RETURNING *",
      [objectPath, proposta.proposta_id]
    );
    res.status(200).json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: `falha ao enviar arquivo: ${(err as Error).message}` });
  }
});

propostaAnexoRouter.get("/propostas/:id/anexo/download", async (req, res) => {
  const { rows } = await query<PropostaRow>("SELECT proposta_id, proposta_anexo FROM propostas WHERE proposta_id = $1", [
    req.params.id,
  ]);
  const proposta = rows[0];
  if (!proposta || !proposta.proposta_anexo) {
    res.status(404).json({ error: "anexo não encontrado" });
    return;
  }
  if (await bloqueado(req, res, "propostas", "perm_leitura")) return;

  if (/^https?:\/\//i.test(proposta.proposta_anexo)) {
    res.json({ url: proposta.proposta_anexo });
    return;
  }

  if (!isStorageConfigured()) {
    res.status(400).json({ error: "Armazenamento de arquivos não configurado (variáveis SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no backend)" });
    return;
  }

  try {
    const url = await getSignedDownloadUrl(proposta.proposta_anexo, `proposta-${proposta.proposta_id}.pdf`);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: `falha ao gerar link de download: ${(err as Error).message}` });
  }
});

propostaAnexoRouter.delete("/propostas/:id/anexo", async (req, res) => {
  const { rows } = await query<PropostaRow>("SELECT proposta_id, proposta_anexo FROM propostas WHERE proposta_id = $1", [
    req.params.id,
  ]);
  const proposta = rows[0];
  if (!proposta) {
    res.status(404).json({ error: "proposta não encontrada" });
    return;
  }
  if (await bloqueado(req, res, "propostas", "perm_edicao")) return;
  if (proposta.proposta_anexo && !/^https?:\/\//i.test(proposta.proposta_anexo)) {
    await deleteObject(proposta.proposta_anexo);
  }
  const { rows: updated } = await query(
    "UPDATE propostas SET proposta_anexo = NULL WHERE proposta_id = $1 RETURNING *",
    [proposta.proposta_id]
  );
  res.json(updated[0]);
});
