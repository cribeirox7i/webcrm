// Leitura (SELECT apenas) do estado atual de anexos.anexo_arquivo, pra planejar a recuperação
// dos arquivos (mesmo caso já resolvido em propostas -- ver recover-propostas-anexo.ts).
// Uso: DATABASE_URL="..." npx tsx scripts/report-anexos.ts
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query(
    `SELECT anexo_id, cliente_id, fornecedor_id, anexo_nome, anexo_arquivo
     FROM anexos ORDER BY anexo_id`
  );
  console.log(`total de linhas em anexos: ${rows.length}`);
  let comArquivo = 0;
  let urlDireta = 0;
  for (const r of rows) {
    const dono = r.fornecedor_id ? `fornecedor ${r.fornecedor_id}` : r.cliente_id ? `cliente ${r.cliente_id}` : "(sem dono)";
    if (r.anexo_arquivo) comArquivo++;
    if (r.anexo_arquivo && /^https?:\/\//i.test(r.anexo_arquivo)) urlDireta++;
    console.log(`${r.anexo_id}\t${dono}\t${r.anexo_arquivo ?? "(vazio)"}`);
  }
  console.log(`\ncom anexo_arquivo preenchido: ${comArquivo} | já sendo URL direta: ${urlDireta}`);
  await client.end();
}

main().catch((err) => {
  console.error("[report] ERRO:", err.message);
  process.exit(1);
});
