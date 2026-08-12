import { Pool, PoolClient } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não definida");
}

// max baixo de propósito: em serverless (Vercel) cada instância mantém seu próprio pool, e a
// conexão real deve passar pelo pooler do Supabase (porta 6543, modo transaction), não pela
// porta direta (5432) -- ver backend/.env.example. Schema/views/triggers não são aplicados
// aqui: rodam uma única vez, fora de banda, via backend/scripts/apply-schema.ts.
export const pool = new Pool({ connectionString, max: 5 });

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const result = await pool.query(text, params);
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}

// Sem transações no código original (SQLite síncrono mascarava a falta disso) -- usado onde
// duas escritas precisam ser atômicas (ex.: trocar senha + revogar sessões antigas).
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
