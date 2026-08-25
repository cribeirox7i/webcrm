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

interface AnexoRow {
  anexo_id: number;
  cliente_id: number | null;
  fornecedor_id: number | null;
  anexo_nome: string | null;
  anexo_data: string | null;
  anexo_arquivo: string | null;
}

// Rotas dedicadas de anexos (upload/download/exclusão com storage) -- montadas antes do
// resourceRouter genérico em server.ts, então GET/POST de listagem simples continuam
// caindo no genérico (/api/anexos, /api/anexos/:id); só as 3 rotas abaixo são específicas.
export const anexosRouter = Router();

anexosRouter.post("/anexos/upload", upload.single("file"), async (req, res) => {
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
  const clienteId = req.body.cliente_id ? Number(req.body.cliente_id) : null;
  const fornecedorId = req.body.fornecedor_id ? Number(req.body.fornecedor_id) : null;
  if (!clienteId && !fornecedorId) {
    res.status(400).json({ error: "informe cliente_id ou fornecedor_id" });
    return;
  }
  const menuKey = clienteId ? "clientes" : "fornecedores";
  if (await bloqueado(req, res, menuKey, "perm_insercao")) return;

  const pasta = await getPastaStorage(menuKey);
  const entityFolder = clienteId ? `clientes/${clienteId}` : `fornecedores/${fornecedorId}`;
  const objectPath = `${pasta}/${entityFolder}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${sanitizeFilename(
    file.originalname
  )}`;
  const nome = (req.body.anexo_nome as string | undefined)?.trim() || file.originalname;

  try {
    await uploadBuffer(objectPath, file.buffer, contentTypeSeguro());
    const { rows } = await query(
      `INSERT INTO anexos (cliente_id, fornecedor_id, anexo_nome, anexo_data, anexo_arquivo) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [clienteId, fornecedorId, nome, new Date().toISOString().slice(0, 10), objectPath]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: `falha ao enviar arquivo: ${(err as Error).message}` });
  }
});

anexosRouter.get("/anexos/:id/download", async (req, res) => {
  const { rows } = await query<AnexoRow>(`SELECT * FROM anexos WHERE anexo_id = $1`, [req.params.id]);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "anexo não encontrado" });
    return;
  }
  if (await bloqueado(req, res, row.cliente_id ? "clientes" : "fornecedores", "perm_leitura")) return;
  if (!row.anexo_arquivo) {
    res.status(404).json({ error: "anexo sem arquivo associado" });
    return;
  }

  // Dado legado da importação do AppSheet: `anexo_arquivo` pode já ser uma URL direta
  // (link do Drive original), não um caminho nosso no bucket -- devolve como está.
  if (/^https?:\/\//i.test(row.anexo_arquivo)) {
    res.json({ url: row.anexo_arquivo });
    return;
  }

  if (!isStorageConfigured()) {
    res.status(400).json({ error: "Armazenamento de arquivos não configurado (variáveis SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no backend)" });
    return;
  }

  try {
    const url = await getSignedDownloadUrl(row.anexo_arquivo, row.anexo_nome ?? "anexo");
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: `falha ao gerar link de download: ${(err as Error).message}` });
  }
});

// Sobrescreve o DELETE genérico só pra essa rota (mesmo path/método, mas montada antes
// do resourceRouter em server.ts) -- precisa apagar o objeto no bucket antes da linha.
anexosRouter.delete("/anexos/:id", async (req, res) => {
  const { rows } = await query<AnexoRow>(`SELECT * FROM anexos WHERE anexo_id = $1`, [req.params.id]);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "anexo não encontrado" });
    return;
  }
  if (await bloqueado(req, res, row.cliente_id ? "clientes" : "fornecedores", "perm_exclusao")) return;
  if (row.anexo_arquivo && !/^https?:\/\//i.test(row.anexo_arquivo)) {
    await deleteObject(row.anexo_arquivo);
  }
  await query(`DELETE FROM anexos WHERE anexo_id = $1`, [req.params.id]);
  res.status(204).send();
});
