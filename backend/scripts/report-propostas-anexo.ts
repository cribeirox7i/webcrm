// Leitura (SELECT apenas) do estado atual de proposta_anexo, pra planejar a recuperação dos
// anexos perdidos na decomissão do bucket GCS antigo. Não escreve nada no banco.
// Uso: DATABASE_URL="postgresql://..." npx tsx scripts/report-propostas-anexo.ts
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query(
    "SELECT proposta_id, proposta_anexo FROM propostas WHERE proposta_id = ANY($1) ORDER BY proposta_id",
    [[11, 20, 23, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44, 46, 47, 48, 49, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62]]
  );
  for (const r of rows) {
    console.log(`${r.proposta_id}\t${r.proposta_anexo ?? "(vazio)"}`);
  }
  await client.end();
}

main().catch((err) => {
  console.error("[report] ERRO:", err.message);
  process.exit(1);
});
