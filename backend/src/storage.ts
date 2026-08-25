import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase Storage, dentro do mesmo projeto Supabase que já hospeda o Postgres -- trocado
// no lugar do Google Cloud Storage (usado antes da decomissão do projeto GCP na migração
// pra Vercel). SUPABASE_SERVICE_ROLE_KEY tem acesso total ao projeto (ignora RLS) -- só
// pode circular no backend, nunca no frontend, mesmo nível de sigilo do DATABASE_URL.
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "anexos";

const supabase: SupabaseClient | null =
  supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }) : null;

export function isStorageConfigured(): boolean {
  return supabase !== null;
}

// Extensões aceitas em anexo de negócio (cliente, fornecedor, proposta). Antes não havia
// validação nenhuma: qualquer .exe/.html/.js era aceito e ficava disponível pra download pelos
// colegas com um nome de anexo legítimo -- o CRM virava vetor de distribuição de malware.
// Whitelist por extensão (não blacklist) porque a lista de tipos legítimos é curta e conhecida.
const EXTENSOES_PERMITIDAS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "xlsm", "csv", "ppt", "pptx",
  "txt", "png", "jpg", "jpeg", "gif", "webp", "zip", "msg", "eml",
]);

/** Devolve a mensagem de erro quando o arquivo não pode ser aceito, ou `null` quando pode.
 * Valida no backend porque o `accept` do input no frontend é só UX -- a requisição pode ser
 * montada à mão. `mimetype` declarado pelo cliente não é confiável, então a decisão é pela
 * extensão do nome original; o mimetype só é barrado quando é explicitamente executável. */
export function erroTipoArquivo(originalname: string, mimetype: string): string | null {
  const ext = originalname.includes(".") ? originalname.split(".").pop()!.toLowerCase() : "";
  if (!EXTENSOES_PERMITIDAS.has(ext)) {
    return `tipo de arquivo não permitido (.${ext || "sem extensão"}) -- aceitos: ${[...EXTENSOES_PERMITIDAS].join(", ")}`;
  }
  if (/^(text\/html|application\/x-msdownload|application\/x-sh|application\/javascript)/i.test(mimetype)) {
    return "tipo de arquivo não permitido";
  }
  return null;
}

/** Content-type gravado no bucket. Nunca usa o mimetype declarado pelo cliente: um arquivo
 * subido como `text/html` seria servido como HTML pelo storage. `octet-stream` força download
 * em qualquer caso, e o `download:` da URL assinada já cuida do nome original. */
export function contentTypeSeguro(): string {
  return "application/octet-stream";
}

export async function uploadBuffer(objectPath: string, buffer: Buffer, contentType: string): Promise<void> {
  if (!supabase) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados");
  const { error } = await supabase.storage.from(bucketName).upload(objectPath, buffer, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

/** URL assinada (expira em 10 min) -- o bucket não é público, só quem pede pela API
 * autenticada (usuário/admin com sessão válida) recebe esse link. `download` força o
 * navegador a baixar com o nome de arquivo original em vez de tentar exibir inline. */
export async function getSignedDownloadUrl(objectPath: string, filename: string): Promise<string> {
  if (!supabase) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados");
  const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(objectPath, 10 * 60, { download: filename });
  if (error || !data) throw new Error(error?.message ?? "falha ao gerar link assinado");
  return data.signedUrl;
}

/** Best-effort: se o objeto já não existir (ou storage não configurado), não trava a
 * exclusão do registro no banco -- o dado do banco é a fonte de verdade, não o bucket. */
export async function deleteObject(objectPath: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.storage.from(bucketName).remove([objectPath]);
  } catch {
    // já não existe / sem permissão -- ignora
  }
}
