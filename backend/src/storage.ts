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
