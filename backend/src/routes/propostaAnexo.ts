import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { db } from "../db";
import { deleteObject, getSignedDownloadUrl, isStorageConfigured, uploadBuffer } from "../storage";
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

propostaAnexoRouter.post("/propostas/:id/anexo", upload.single("file"), (req, res) => {
  if (!isStorageConfigured()) {
    res.status(400).json({ error: "Armazenamento de arquivos não configurado (variável GCS_BUCKET ausente no backend)" });
    return;
  }
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "arquivo não enviado" });
    return;
  }
  const proposta = db.prepare("SELECT proposta_id, proposta_anexo FROM propostas WHERE proposta_id = ?").get(
    req.params.id
  ) as PropostaRow | undefined;
  if (!proposta) {
    res.status(404).json({ error: "proposta não encontrada" });
    return;
  }
  if (bloqueado(req, res, "propostas", "perm_edicao")) return;

  const objectPath = `propostas/${proposta.proposta_id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${sanitizeFilename(
    file.originalname
  )}`;

  uploadBuffer(objectPath, file.buffer, file.mimetype || "application/octet-stream")
    .then(async () => {
      if (proposta.proposta_anexo && !/^https?:\/\//i.test(proposta.proposta_anexo)) {
        await deleteObject(proposta.proposta_anexo);
      }
      db.prepare("UPDATE propostas SET proposta_anexo = ? WHERE proposta_id = ?").run(objectPath, proposta.proposta_id);
      const row = db.prepare("SELECT * FROM propostas WHERE proposta_id = ?").get(proposta.proposta_id);
      res.status(200).json(row);
    })
    .catch((err) => {
      res.status(500).json({ error: `falha ao enviar arquivo: ${(err as Error).message}` });
    });
});

propostaAnexoRouter.get("/propostas/:id/anexo/download", async (req, res) => {
  const proposta = db.prepare("SELECT proposta_id, proposta_anexo FROM propostas WHERE proposta_id = ?").get(
    req.params.id
  ) as PropostaRow | undefined;
  if (!proposta || !proposta.proposta_anexo) {
    res.status(404).json({ error: "anexo não encontrado" });
    return;
  }
  // Mesmo achado de anexos.ts: rota dedicada sem checagem de permissão nenhuma, diferente
  // do upload/exclusão ao lado.
  if (bloqueado(req, res, "propostas", "perm_leitura")) return;

  if (/^https?:\/\//i.test(proposta.proposta_anexo)) {
    res.json({ url: proposta.proposta_anexo });
    return;
  }

  if (!isStorageConfigured()) {
    res.status(400).json({ error: "Armazenamento de arquivos não configurado (variável GCS_BUCKET ausente no backend)" });
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
  const proposta = db.prepare("SELECT proposta_id, proposta_anexo FROM propostas WHERE proposta_id = ?").get(
    req.params.id
  ) as PropostaRow | undefined;
  if (!proposta) {
    res.status(404).json({ error: "proposta não encontrada" });
    return;
  }
  if (bloqueado(req, res, "propostas", "perm_edicao")) return;
  if (proposta.proposta_anexo && !/^https?:\/\//i.test(proposta.proposta_anexo)) {
    await deleteObject(proposta.proposta_anexo);
  }
  db.prepare("UPDATE propostas SET proposta_anexo = NULL WHERE proposta_id = ?").run(proposta.proposta_id);
  const row = db.prepare("SELECT * FROM propostas WHERE proposta_id = ?").get(proposta.proposta_id);
  res.json(row);
});
