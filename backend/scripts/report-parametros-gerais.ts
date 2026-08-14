// Leitura (SELECT apenas) dos valores atuais de parametros_gerais, pra diagnosticar o logo
// errado aparecendo na capa dos PDFs. Uso: DATABASE_URL="..." npx tsx scripts/report-parametros-gerais.ts
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query("SELECT * FROM parametros_gerais WHERE param_id = 1");
  console.log(rows[0]);
  await client.end();
}

main().catch((err) => {
  console.error("[report] ERRO:", err.message);
  process.exit(1);
});
