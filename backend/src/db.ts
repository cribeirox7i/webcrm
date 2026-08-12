import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DB_PATH = join(__dirname, "..", "data", "webcrm.sqlite");
const SQL_DIR = join(__dirname, "..", "..");

export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA journal_mode = WAL");

function applyIfEmpty() {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'")
    .get() as { n: number };
  if (row.n > 0) return;

  for (const file of ["schema.sql", "views.sql", "triggers.sql"]) {
    const sql = readFileSync(join(SQL_DIR, file), "utf-8");
    db.exec(sql);
    console.log(`[db] aplicado ${file}`);
  }
}

applyIfEmpty();
