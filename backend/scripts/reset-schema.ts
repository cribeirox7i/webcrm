import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  console.log("[reset] schema public recriado (vazio)");
  await client.end();
}

main().catch((err) => {
  console.error("[reset] ERRO:", err.message);
  process.exit(1);
});
