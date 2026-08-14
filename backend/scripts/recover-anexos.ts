// Recupera os anexos de fornecedores/clientes (tabela `anexos`) do mesmo jeito que já foi feito
// com as propostas -- ver recover-propostas-anexo.ts pro contexto completo. Resumo: os valores
// em anexo_arquivo nunca foram caminhos nossos (GCS ou Supabase), eram um resquício bruto da
// estrutura interna do AppSheet ("Files/Anexos/<id>.anexo_arquivo..."), nunca resolvidos. Os
// arquivos reais sobreviveram no Google Drive original (sincronizado localmente).
//
// Este script, por linha de `anexos`:
// 1. Lê anexo_arquivo e localiza o arquivo de mesmo nome-base na pasta do Drive.
// 2. Sobe pro Supabase Storage no MESMO formato de objectPath que o upload do app usa
//    (ver backend/src/routes/anexos.ts) -- pasta configurável + clientes/<id> ou
//    fornecedores/<id> -- pra que uploads futuros pelo app fiquem lado a lado com estes.
// 3. Atualiza anexo_arquivo pro caminho novo -- só então o download volta a funcionar.
//
// Por padrão roda em modo simulação (não grava nada) -- passar --apply pra gravar de verdade.
//
// Uso:
//   DATABASE_URL="..." SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
//     npx tsx scripts/recover-anexos.ts [--apply]
import path from "node:path";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const DRIVE_FOLDER = "I:/Meu Drive/WEBCRM/Files/Anexos";
const APPLY = process.argv.includes("--apply");

// mesma função de routes/anexos.ts -- o nome final no bucket precisa bater com a convenção do app
function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 150);
}

function contentTypeOf(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".zip") return "application/zip";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

interface AnexoRow {
  anexo_id: number;
  cliente_id: number | null;
  fornecedor_id: number | null;
  anexo_nome: string | null;
  anexo_arquivo: string | null;
}

async function main() {
  const dbClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await dbClient.connect();

  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (APPLY && (!supabaseUrl || !serviceRoleKey)) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente (obrigatórios com --apply)");
  }
  const supabase =
    supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }) : null;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "anexos";

  // pasta configurada no Admin > Armazenamento por menu (default = o próprio menu_key)
  const { rows: pastaRows } = await dbClient.query<{ menu_key: string; pasta: string }>(
    "SELECT menu_key, pasta FROM parametros_storage_menu WHERE menu_key IN ('clientes', 'fornecedores')"
  );
  const pastaPorMenu = new Map(pastaRows.map((r) => [r.menu_key, r.pasta]));
  const pastaDe = (menuKey: string) => pastaPorMenu.get(menuKey) || menuKey;

  const { rows } = await dbClient.query<AnexoRow>(
    "SELECT anexo_id, cliente_id, fornecedor_id, anexo_nome, anexo_arquivo FROM anexos ORDER BY anexo_id"
  );

  console.log(`[recover] modo: ${APPLY ? "APLICANDO (grava de verdade)" : "SIMULAÇÃO (nada será gravado)"}`);
  console.log(`[recover] bucket "${bucketName}" | pasta clientes="${pastaDe("clientes")}" fornecedores="${pastaDe("fornecedores")}"`);

  let ok = 0;
  let pulados = 0;
  const naoEncontrados: string[] = [];

  for (const row of rows) {
    const { anexo_id, cliente_id, fornecedor_id, anexo_arquivo } = row;
    if (!anexo_arquivo) {
      console.log(`[${anexo_id}] SKIP -- anexo_arquivo vazio`);
      pulados++;
      continue;
    }
    if (/^https?:\/\//i.test(anexo_arquivo)) {
      console.log(`[${anexo_id}] SKIP -- já é link direto`);
      pulados++;
      continue;
    }

    const baseName = path.basename(anexo_arquivo);
    const localPath = path.join(DRIVE_FOLDER, baseName);

    // mesma convenção de routes/anexos.ts: menu dono é fornecedores quando não há cliente_id
    const menuKey = cliente_id ? "clientes" : "fornecedores";
    const entityFolder = cliente_id ? `clientes/${cliente_id}` : `fornecedores/${fornecedor_id}`;

    try {
      const buffer = await readFile(localPath);
      const objectPath = `${pastaDe(menuKey)}/${entityFolder}/${Date.now()}-${crypto
        .randomBytes(6)
        .toString("hex")}-${sanitizeFilename(baseName)}`;

      console.log(`[${anexo_id}] ${baseName} (${buffer.length} bytes) -> ${objectPath}`);

      if (APPLY) {
        const { error: uploadError } = await supabase!.storage
          .from(bucketName)
          .upload(objectPath, buffer, { contentType: contentTypeOf(baseName), upsert: true });
        if (uploadError) throw new Error(`upload: ${uploadError.message}`);
        await dbClient.query("UPDATE anexos SET anexo_arquivo = $1 WHERE anexo_id = $2", [objectPath, anexo_id]);
      }
      ok++;
    } catch (err) {
      const msg = (err as NodeJS.ErrnoException).code === "ENOENT" ? "arquivo não encontrado na pasta do Drive" : (err as Error).message;
      console.error(`[${anexo_id}] ERRO -- ${msg} (${anexo_arquivo})`);
      naoEncontrados.push(`${anexo_id}: ${anexo_arquivo}`);
    }
  }

  console.log(`\n[recover] ${ok} ok | ${pulados} pulados | ${naoEncontrados.length} não recuperados, de ${rows.length} linhas.`);
  if (naoEncontrados.length) {
    console.log("[recover] não recuperados (arquivo não existe em nenhuma pasta sincronizada):");
    naoEncontrados.forEach((n) => console.log(`  - ${n}`));
  }
  await dbClient.end();
}

main().catch((err) => {
  console.error("[recover] ERRO FATAL:", err.message);
  process.exit(1);
});
