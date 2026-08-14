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

  // As 3 consultas abaixo trazem TODAS as tabelas/views/colunas/PKs do schema de uma vez --
  // antes disso era 1 consulta pra listar as tabelas + 2 consultas POR TABELA (colunas + PK)
  // num loop sequencial, ~70+ idas e vindas ao banco só pra montar o catálogo. Isso rodava
  // inteiro toda vez que uma instância nova do backend "acordava" no Vercel (cold start --
  // comum no plano Hobby, que desliga a função sem tráfego), antes de responder qualquer
  // request -- causa real do "às vezes demora uns 5-7 segundos" reportado pelo usuário.
  const [objectsRes, colsRes, pkRes] = await Promise.all([
    query<{ name: string; type: "BASE TABLE" | "VIEW" }>(
      `SELECT table_name AS name, table_type AS type
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type IN ('BASE TABLE', 'VIEW')`
    ),
    query<{ table_name: string; name: string }>(
      `SELECT table_name, column_name AS name FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`
    ),
    // só expõe PK quando é de 1 coluna só (mesma regra do node:sqlite/PRAGMA table_info
    // original) -- tabelas com PK composta (usuarios_permissoes_menu, indices_economicos)
    // continuam de fora da rota genérica, com rotas dedicadas (ver routes/permissoes.ts).
    query<{ table_name: string; name: string }>(
      `SELECT tc.table_name, kcu.column_name AS name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'`
    ),
  ]);

  const colsByTable = new Map<string, string[]>();
  for (const c of colsRes.rows) {
    const list = colsByTable.get(c.table_name) ?? [];
    list.push(c.name);
    colsByTable.set(c.table_name, list);
  }

  const pksByTable = new Map<string, string[]>();
  for (const p of pkRes.rows) {
    const list = pksByTable.get(p.table_name) ?? [];
    list.push(p.name);
    pksByTable.set(p.table_name, list);
  }

  for (const obj of objectsRes.rows) {
    const pkCols = pksByTable.get(obj.name) ?? [];
    catalog.set(obj.name, {
      name: obj.name,
      kind: obj.type === "BASE TABLE" ? "table" : "view",
      columns: colsByTable.get(obj.name) ?? [],
      pk: obj.type === "BASE TABLE" && pkCols.length === 1 ? pkCols[0] : null,
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
