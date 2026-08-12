import { query } from "./db";

export interface ResourceInfo {
  name: string;
  kind: "table" | "view";
  columns: string[];
  pk: string | null; // null para views (read-only) e tabelas com PK composta (sem rota genérica)
}

export const catalog = new Map<string, ResourceInfo>();

// Populado uma vez por instância (cold start), reusado nas próximas requisições -- substitui
// o antigo loadCatalog() síncrono chamado no module load (que dependia de node:sqlite ser
// bloqueante). Todo consumidor do catalog precisa chamar `await ensureCatalogLoaded()` antes
// de ler o Map, já que a primeira requisição de uma instância nova precisa esperar essa
// consulta assíncrona terminar.
let loaded: Promise<void> | null = null;

export function ensureCatalogLoaded(): Promise<void> {
  if (!loaded) {
    loaded = loadCatalog();
  }
  return loaded;
}

async function loadCatalog() {
  catalog.clear();

  const { rows: objects } = await query<{ name: string; type: "BASE TABLE" | "VIEW" }>(
    `SELECT table_name AS name, table_type AS type
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type IN ('BASE TABLE', 'VIEW')`
  );

  for (const obj of objects) {
    const { rows: cols } = await query<{ name: string }>(
      `SELECT column_name AS name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [obj.name]
    );

    let pk: string | null = null;
    if (obj.type === "BASE TABLE") {
      // só expõe PK quando é de 1 coluna só (mesma regra do node:sqlite/PRAGMA table_info
      // original) -- tabelas com PK composta (usuarios_permissoes_menu, indices_economicos)
      // continuam de fora da rota genérica, com rotas dedicadas (ver routes/permissoes.ts).
      const { rows: pkRows } = await query<{ name: string }>(
        `SELECT kcu.column_name AS name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
         WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
        [obj.name]
      );
      pk = pkRows.length === 1 ? pkRows[0].name : null;
    }

    catalog.set(obj.name, {
      name: obj.name,
      kind: obj.type === "BASE TABLE" ? "table" : "view",
      columns: cols.map((c) => c.name),
      pk,
    });
  }
}

// nomes de tabela/view vêm do catalog (não do usuário), mas mesmo assim validamos que é um
// identificador seguro antes de interpolar em SQL.
export function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`identificador inválido: ${name}`);
  }
  return `"${name}"`;
}
