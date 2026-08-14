// Exclui as linhas de `anexos` cujo arquivo não existe em lugar nenhum -- as 3 sobras da
// estrutura de app anterior (FORNECEDORES_DOCS / coluna forndoc_anexo), que não foram
// recuperadas por recover-anexos.ts porque o arquivo não está em nenhuma pasta sincronizada
// do Drive. Sem isso, elas ficam na tela dando erro de "objeto não encontrado" no download.
//
// EXCLUSÃO É IRREVERSÍVEL. Por isso o script:
// 1. Roda em SIMULAÇÃO por padrão -- só grava com --apply.
// 2. Só toca nos IDs listados em IDS_ESPERADOS (não faz DELETE por padrão/WHERE aberto).
// 3. Antes de excluir cada linha, confere que ela AINDA tem o caminho legado (forndoc_anexo).
//    Se alguém tiver corrigido/reenviado o anexo nesse meio tempo, a linha é PULADA em vez
//    de excluída -- a guarda existe justamente pra não apagar um anexo que voltou a ser válido.
// 4. Não mexe no Supabase Storage: essas linhas nunca tiveram objeto lá pra apagar.
//
// Uso:
//   DATABASE_URL="..." npx tsx scripts/delete-anexos-orfaos.ts [--apply]
import { Client } from "pg";

const IDS_ESPERADOS = [1, 2, 3];
const PADRAO_LEGADO = /forndoc_anexo/i;
const APPLY = process.argv.includes("--apply");

interface AnexoRow {
  anexo_id: number;
  cliente_id: number | null;
  fornecedor_id: number | null;
  anexo_nome: string | null;
  anexo_data: string | null;
  anexo_arquivo: string | null;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log(`[delete] modo: ${APPLY ? "APLICANDO (exclui de verdade)" : "SIMULAÇÃO (nada será excluído)"}`);

  const { rows } = await client.query<AnexoRow>(
    "SELECT anexo_id, cliente_id, fornecedor_id, anexo_nome, anexo_data, anexo_arquivo FROM anexos WHERE anexo_id = ANY($1) ORDER BY anexo_id",
    [IDS_ESPERADOS]
  );

  let excluidos = 0;
  let pulados = 0;

  for (const id of IDS_ESPERADOS) {
    const row = rows.find((r) => r.anexo_id === id);
    if (!row) {
      console.log(`[${id}] PULADO -- linha já não existe`);
      pulados++;
      continue;
    }
    if (!row.anexo_arquivo || !PADRAO_LEGADO.test(row.anexo_arquivo)) {
      console.log(`[${id}] PULADO (guarda) -- não tem mais o caminho legado: ${row.anexo_arquivo ?? "(vazio)"}`);
      pulados++;
      continue;
    }

    const dono = row.fornecedor_id ? `fornecedor ${row.fornecedor_id}` : `cliente ${row.cliente_id}`;
    console.log(`[${id}] EXCLUIR -- ${dono} | nome="${row.anexo_nome ?? ""}" data=${row.anexo_data ?? ""}`);
    console.log(`         arquivo: ${row.anexo_arquivo}`);

    if (APPLY) {
      const res = await client.query("DELETE FROM anexos WHERE anexo_id = $1 AND anexo_arquivo = $2", [
        id,
        row.anexo_arquivo,
      ]);
      if (res.rowCount !== 1) {
        console.error(`[${id}] ERRO -- DELETE afetou ${res.rowCount} linhas (esperado 1), nada foi confirmado pra este id`);
        continue;
      }
      excluidos++;
    } else {
      excluidos++;
    }
  }

  console.log(
    `\n[delete] ${APPLY ? "excluídos" : "seriam excluídos"}: ${excluidos} | pulados: ${pulados} | de ${IDS_ESPERADOS.length} ids alvo.`
  );
  if (!APPLY) console.log("[delete] rode de novo com --apply pra excluir de verdade.");
  await client.end();
}

main().catch((err) => {
  console.error("[delete] ERRO FATAL:", err.message);
  process.exit(1);
});
