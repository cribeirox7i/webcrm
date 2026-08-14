// Aplica NOT NULL em clientes.cliente_cnpj -- confirmado antes que os 601 clientes reais ja
// tem 100% de cobertura nesse campo (nenhum NULL), entao e seguro. Uso:
// DATABASE_URL="..." npx tsx scripts/migrate-cliente-cnpj-notnull.ts
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const check = await client.query(
    "SELECT COUNT(*)::int AS n FROM clientes WHERE cliente_cnpj IS NULL OR cliente_cnpj = ''"
  );
  if (check.rows[0].n > 0) {
    throw new Error(`Abortado: ${check.rows[0].n} clientes ainda sem CNPJ -- resolver antes de aplicar NOT NULL.`);
  }
  await client.query("ALTER TABLE clientes ALTER COLUMN cliente_cnpj SET NOT NULL");
  console.log("[migrate] OK -- clientes.cliente_cnpj agora e NOT NULL.");
  await client.end();
}

main().catch((err) => {
  console.error("[migrate] ERRO:", err.message);
  process.exit(1);
});
