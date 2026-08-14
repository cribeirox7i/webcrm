// Recupera os anexos de propostas perdidos na decomissão do bucket GCS antigo -- os valores
// gravados em proposta_anexo nunca foram, de fato, caminhos nossos (GCS ou Supabase): eram um
// resquício bruto da estrutura interna do AppSheet ("Files/Propostas/<id>.proposta_anexo...",
// "APPSHEET/data/<appid>/propostas/..."), nunca resolvidos. Os arquivos reais sobreviveram no
// Google Drive original (sincronizado localmente via Google Drive para Desktop). Este script:
// 1. Lê o valor atual de proposta_anexo de cada proposta da lista.
// 2. Localiza o arquivo correspondente (mesmo nome-base) na pasta do Drive sincronizada.
// 3. Sobe pro Supabase Storage, na pasta configurada em parametros_storage_menu (ou "propostas"
//    default), no MESMO formato de objectPath que o upload normal do app usa.
// 4. Atualiza proposta_anexo pro novo caminho -- só então o download volta a funcionar.
//
// Por padrão roda em modo simulação (não grava nada) -- passar --apply pra gravar de verdade.
//
// Uso:
//   DATABASE_URL="..." SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
//     npx tsx scripts/recover-propostas-anexo.ts [--apply]
import path from "node:path";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const DRIVE_FOLDER = "I:/Meu Drive/WEBCRM/Files/Propostas";
const PROPOSTA_IDS = [
  11, 20, 23, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44, 46, 47, 48, 49, 53, 54, 55, 56, 57,
  58, 59, 60, 61, 62,
];

const APPLY = process.argv.includes("--apply");

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 150);
}

async function main() {
  const dbClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await dbClient.connect();

  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (APPLY && (!supabaseUrl || !serviceRoleKey)) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente (obrigatórios com --apply)");
  }
  const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }) : null;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "anexos";

  const { rows: pastaRows } = await dbClient.query<{ pasta: string }>(
    "SELECT pasta FROM parametros_storage_menu WHERE menu_key = 'propostas'"
  );
  const pasta = pastaRows[0]?.pasta || "propostas";

  console.log(`[recover] modo: ${APPLY ? "APLICANDO (grava de verdade)" : "SIMULAÇÃO (nada será gravado)"}`);
  console.log(`[recover] pasta de destino no bucket "${bucketName}": ${pasta}/`);

  let ok = 0;
  let falhou = 0;

  for (const propostaId of PROPOSTA_IDS) {
    const { rows } = await dbClient.query<{ proposta_anexo: string | null }>(
      "SELECT proposta_anexo FROM propostas WHERE proposta_id = $1",
      [propostaId]
    );
    const anexoAtual = rows[0]?.proposta_anexo;
    if (!anexoAtual) {
      console.log(`[${propostaId}] SKIP -- proposta_anexo já está vazio`);
      continue;
    }
    if (/^https?:\/\//i.test(anexoAtual)) {
      console.log(`[${propostaId}] SKIP -- já é um link direto (${anexoAtual})`);
      continue;
    }

    const baseName = path.basename(anexoAtual);
    const localPath = path.join(DRIVE_FOLDER, baseName);
    try {
      const buffer = await readFile(localPath);
      const objectPath = `${pasta}/${propostaId}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${sanitizeFilename(
        baseName
      )}`;

      console.log(`[${propostaId}] ${baseName} (${buffer.length} bytes) -> ${objectPath}`);

      if (APPLY) {
        const contentType =
          baseName.endsWith(".pdf") ? "application/pdf" :
          baseName.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :
          baseName.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
          "application/octet-stream";
        const { error: uploadError } = await supabase!.storage.from(bucketName).upload(objectPath, buffer, {
          contentType,
          upsert: true,
        });
        if (uploadError) throw new Error(`upload: ${uploadError.message}`);
        await dbClient.query("UPDATE propostas SET proposta_anexo = $1 WHERE proposta_id = $2", [
          objectPath,
          propostaId,
        ]);
      }
      ok++;
    } catch (err) {
      falhou++;
      console.error(`[${propostaId}] ERRO -- ${(err as Error).message}`);
    }
  }

  console.log(`[recover] concluído: ${ok} ok, ${falhou} falharam, de ${PROPOSTA_IDS.length} propostas.`);
  await dbClient.end();
}

main().catch((err) => {
  console.error("[recover] ERRO FATAL:", err.message);
  process.exit(1);
});
