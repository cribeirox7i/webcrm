// Aplica schema.pg.sql/views.pg.sql/triggers.pg.sql contra um Postgres (Supabase) vazio.
// Uso: DATABASE_URL="postgresql://..." npx tsx scripts/apply-schema.ts
// Rodar uma única vez por projeto Supabase (schema/views/triggers não fazem parte do boot
// do app em produção -- ver backend/src/db.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const root = join(__dirname, "..", "..");
  for (const file of ["schema.pg.sql", "views.pg.sql", "triggers.pg.sql"]) {
    const sql = readFileSync(join(root, file), "utf-8");
    console.log(`[apply] ${file}...`);
    await client.query(sql);
    console.log(`[apply] ${file} ok`);
  }
  await client.end();
}

main().catch((err) => {
  console.error("[apply] ERRO:", err.message);
  process.exit(1);
});
