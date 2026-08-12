// Migra os dados do SQLite local (backend/data/webcrm.sqlite) pro Postgres (Supabase).
// Le direto do banco de teste ja existente (nao reprocessa o WEBCRM.xlsx original -- ver
// import_test_data.py, que continua sendo so a ferramenta de carga de massa de teste a
// partir da planilha). Roda depois de schema.pg.sql/views.pg.sql/triggers.pg.sql (via
// apply-schema.ts) ja terem sido aplicados no banco de destino.
//
// Uso: DATABASE_URL="postgresql://..." npx tsx scripts/migrate-sqlite-to-pg.ts [caminho-sqlite]
//
// ACHADO na massa de teste atual (2026-08-12), ainda sem tratamento aqui: 306 das 2429 linhas
// de `urls` têm cliente_id = 0, um valor "sentinela" herdado da planilha original que não
// existe em `clientes` -- viola a FK (`urls_cliente_id_fkey`) e quebra a migração no meio.
// Antes de rodar contra dados reais, decidir com o usuário o que fazer com esses casos (pular
// a linha? criar um cliente "sem dono" com id reservado? tratar como null, exigindo relaxar o
// NOT NULL?) -- não pular silenciosamente sem essa decisão.
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { Pool } from "pg";

// Mesma ordem de dependencia de FK do import_test_data.py -- urls entra logo apos
// clientes/produtos/servidores (dispara os triggers de cliente_status), pessoas com FK off
// (hierarquia auto-referenciada). usuarios/usuarios_permissoes_menu ficam no fim, ja que
// dependem de nada alem de si mesmas.
const TABLE_ORDER = [
  "grupos_econ",
  "clientes",
  "produtos",
  "servidores",
  "list_resp_crono",
  "list_tip_resp",
  "list_url_status",
  "indices_economicos",
  "fornecedores",
  "urls",
  "pessoas",
  "ferias_marcacao",
  "contatos",
  "cart_mes",
  "precos_cliente",
  "consumo_ana",
  "faturamento",
  "carteira",
  "resp",
  "escala",
  "portfolios",
  "crono",
  "propostas",
  "forn_contratos",
  "forn_pagadoria",
  "anexos",
  "usuarios",
  "usuarios_permissoes_menu",
];

const BATCH_SIZE = 500;

async function destinationColumns(pg: Pool, table: string): Promise<string[]> {
  const { rows } = await pg.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'
     ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((r) => r.column_name);
}

async function singleColumnPk(pg: Pool, table: string): Promise<string | null> {
  const { rows } = await pg.query<{ column_name: string }>(
    `SELECT kcu.column_name FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
     WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
    [table]
  );
  return rows.length === 1 ? rows[0].column_name : null;
}

async function migrateTable(sqlite: DatabaseSync, pg: Pool, table: string) {
  const columns = await destinationColumns(pg, table);
  if (!columns.length) {
    console.log(`[skip] ${table}: não existe no destino`);
    return;
  }

  let sourceRows: Record<string, unknown>[];
  try {
    sourceRows = sqlite.prepare(`SELECT ${columns.join(", ")} FROM ${table}`).all() as Record<string, unknown>[];
  } catch (err) {
    console.log(`[skip] ${table}: não encontrada no SQLite de origem (${(err as Error).message})`);
    return;
  }

  if (!sourceRows.length) {
    console.log(`[ok] ${table}: 0 linhas (nada a migrar)`);
    return;
  }

  for (let i = 0; i < sourceRows.length; i += BATCH_SIZE) {
    const batch = sourceRows.slice(i, i + BATCH_SIZE);
    const valuesSql: string[] = [];
    const params: unknown[] = [];
    batch.forEach((row, rowIdx) => {
      const placeholders = columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`);
      valuesSql.push(`(${placeholders.join(", ")})`);
      columns.forEach((col) => params.push(row[col] ?? null));
    });
    await pg.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ${valuesSql.join(", ")}`, params);
  }

  console.log(`[ok] ${table}: ${sourceRows.length} linhas migradas`);

  // avança a sequence do IDENTITY pra não colidir com o próximo INSERT real (sem isso, o
  // próximo POST genérico via resource.ts tentaria usar um ID já ocupado pelos dados migrados).
  const pkCol = await singleColumnPk(pg, table);
  if (pkCol && columns.includes(pkCol)) {
    const maxVal = sourceRows.reduce((max, row) => {
      const v = Number(row[pkCol]);
      return Number.isFinite(v) && v > max ? v : max;
    }, 0);
    await pg.query(`SELECT setval(pg_get_serial_sequence($1, $2), $3, $4)`, [table, pkCol, maxVal, maxVal > 0]);
  }
}

async function main() {
  const sqlitePath = process.argv[2] || join(__dirname, "..", "data", "webcrm.sqlite");
  const sqlite = new DatabaseSync(sqlitePath);
  const pg = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl: { rejectUnauthorized: false } });

  console.log(`[migrate] origem: ${sqlitePath}`);
  for (const table of TABLE_ORDER) {
    await migrateTable(sqlite, pg, table);
  }

  await pg.end();
  sqlite.close();
  console.log("[migrate] concluído");
}

main().catch((err) => {
  console.error("[migrate] ERRO:", err);
  process.exit(1);
});
