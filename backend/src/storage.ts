import { Storage } from "@google-cloud/storage";

// GCS_BUCKET: nome do bucket do Google Cloud Storage usado pra guardar os anexos
// (contratos, aditivos etc.). Sem essa variável, o upload/download fica desligado --
// mesmo padrão de "não configurado ainda" já usado pra SMTP/ADMIN_PIN. Credenciais vêm
// via Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS ou a conta de
// serviço da própria VM em produção) -- @google-cloud/storage lê isso sozinho.
const bucketName = process.env.GCS_BUCKET ?? "";
const storage = bucketName ? new Storage() : null;

export function isStorageConfigured(): boolean {
  return storage !== null;
}

export async function uploadBuffer(objectPath: string, buffer: Buffer, contentType: string): Promise<void> {
  if (!storage) throw new Error("GCS_BUCKET não configurado");
  await storage.bucket(bucketName).file(objectPath).save(buffer, { contentType, resumable: false });
}

/** URL assinada (v4, expira em 10 min) -- o arquivo no bucket não é público, só quem
 * tem a sessão de usuário válida consegue pedir esse link pela API autenticada. */
export async function getSignedDownloadUrl(objectPath: string, filename: string): Promise<string> {
  if (!storage) throw new Error("GCS_BUCKET não configurado");
  const [url] = await storage
    .bucket(bucketName)
    .file(objectPath)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 10 * 60 * 1000,
      responseDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
    });
  return url;
}

/** Best-effort: se o objeto já não existir (ou storage não configurado), não trava a
 * exclusão do registro no banco -- o dado do banco é a fonte de verdade, não o bucket. */
export async function deleteObject(objectPath: string): Promise<void> {
  if (!storage) return;
  try {
    await storage.bucket(bucketName).file(objectPath).delete();
  } catch {
    // já não existe / sem permissão -- ignora
  }
}
