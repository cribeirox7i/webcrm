import { db } from "./db";

export interface ResourceInfo {
  name: string;
  kind: "table" | "view";
  columns: string[];
  pk: string | null; // null para views (read-only, sem PK relevante pra API)
}

export const catalog = new Map<string, ResourceInfo>();

function loadCatalog() {
  catalog.clear();

  const objects = db
    .prepare(
      `SELECT name, type FROM sqlite_master
       WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'`
    )
    .all() as { name: string; type: "table" | "view" }[];

  for (const obj of objects) {
    const cols = db.prepare(`PRAGMA table_info(${quoteIdent(obj.name)})`).all() as {
      name: string;
      pk: number;
    }[];

    const pkCol = cols.find((c) => c.pk === 1);

    catalog.set(obj.name, {
      name: obj.name,
      kind: obj.type,
      columns: cols.map((c) => c.name),
      pk: obj.type === "table" ? pkCol?.name ?? null : null,
    });
  }
}

// nomes de tabela/view vem do sqlite_master (não do usuário), mas mesmo assim
// validamos que é um identificador seguro antes de interpolar em SQL.
export function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`identificador inválido: ${name}`);
  }
  return `"${name}"`;
}

loadCatalog();
