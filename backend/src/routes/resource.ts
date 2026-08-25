import { Router, Request, Response } from "express";
import { query } from "../db";
import { catalog, quoteIdent, ensureCatalogLoaded } from "../catalog";
import { enforceMenuPermission } from "../permissaoResource";

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 20000; // as telas do CRM chegam a carregar 15-20 mil linhas de uma vez

// Colunas que nenhuma rota genérica (POST/PUT) pode escrever, mesmo autenticado --
// só as rotas dedicadas (routes/auth.ts, routes/usuarios.ts) sabem gravar isso direito
// (hash de senha, token de convite). Sem isso, um PUT genérico em /api/usuarios
// conseguiria sobrescrever a senha de outro usuário direto.
const PROTECTED_COLUMNS: Record<string, string[]> = {
  usuarios: ["user_senha_hash", "user_deve_trocar_senha", "user_convite_token", "user_convite_expira_em"],
};

function isWritable(resource: string, column: string): boolean {
  return !(PROTECTED_COLUMNS[resource] ?? []).includes(column);
}

// Colunas que nunca voltam numa resposta JSON, mesmo pra quem tem permissão de leitura --
// hash de senha e token de convite são credenciais, não dado de cadastro.
const REDACTED_COLUMNS: Record<string, string[]> = {
  usuarios: ["user_senha_hash", "user_convite_token"],
};

export function redactRow<T extends Record<string, unknown>>(resource: string, row: T): T {
  const hide = REDACTED_COLUMNS[resource];
  if (!hide) return row;
  const copy = { ...row };
  for (const col of hide) delete copy[col];
  return copy;
}

function redactRows<T extends Record<string, unknown>>(resource: string, rows: T[]): T[] {
  return REDACTED_COLUMNS[resource] ? rows.map((r) => redactRow(resource, r)) : rows;
}

// Colunas que não aceitam valor negativo: quantidade, valor monetário e percentual de progresso.
// O roteador genérico só checava "a coluna existe" + "o usuário tem a permissão do menu", então
// quem tem perm_edicao em Financeiro gravava -50000 em cart_vlr ou preço unitário negativo sem
// nada barrar. Validado aqui (não só por CHECK no banco) pra devolver mensagem clara ao usuário
// e pra valer mesmo onde a constraint ainda não foi aplicada em produção.
//
// Lista explícita por recurso, não regra por prefixo de nome: é o mesmo motivo do
// MENU_BY_RESOURCE em permissaoResource.ts -- adivinhar por padrão de nome erra em coluna nova.
// `null`/`undefined`/string vazia passam de propósito: "não informado" é diferente de "negativo",
// e a obrigatoriedade quem decide é o NOT NULL do schema.
const COLUNAS_NAO_NEGATIVAS: Record<string, string[]> = {
  carteira: [
    "cart_qtd", "cart_vlr", "cart_pdd", "cart_sem_pdd", "cart_fat",
    "cart_qtd_mes", "cart_emprestimos_mes",
  ],
  precos_cliente: [
    "pc_vlr_franquia", "pc_vlr_unit",
    "pc_fx1_lim", "pc_fx2_lim", "pc_fx3_lim", "pc_fx4_lim", "pc_fx5_lim",
    "pc_fx1_vlr", "pc_fx2_vlr", "pc_fx3_vlr", "pc_fx4_vlr", "pc_fx5_vlr",
  ],
  consumo_ana: ["consumo_qtd"],
  // crono_replan/crono_inicio/crono_fim são TEXT (data), não entram aqui. crono_perc_atual é
  // percentual e hh_orc/hh_real são horas -- nenhum dos três faz sentido negativo.
  crono: ["crono_perc_atual", "crono_hh_orc", "crono_hh_real"],
};

/** Valida domínio de negócio das colunas gravadas. Devolve a mensagem de erro, ou `null` se
 * está tudo bem. Roda antes do INSERT/UPDATE, sobre as entradas já filtradas pelo catálogo. */
export function erroDominio(resource: string, entries: [string, unknown][]): string | null {
  const naoNegativas = COLUNAS_NAO_NEGATIVAS[resource];
  if (!naoNegativas) return null;
  for (const [coluna, valor] of entries) {
    if (!naoNegativas.includes(coluna)) continue;
    if (valor === null || valor === undefined || valor === "") continue;
    const n = typeof valor === "number" ? valor : Number(valor);
    if (Number.isNaN(n)) return `${coluna}: valor inválido (esperado número)`;
    if (n < 0) return `${coluna}: não aceita valor negativo`;
  }
  return null;
}

// Erro do Postgres traz nome de constraint/coluna/tipo do schema interno -- útil pro dono do
// sistema, mas é detalhe de implementação vazando pro cliente. Só a violação de constraint
// (23xxx: unique, FK, NOT NULL, check) volta com a mensagem original, porque é a única que o
// usuário consegue agir em cima ("CNPJ já cadastrado"); o resto vira mensagem genérica e o
// detalhe fica no log do servidor.
function responderErroEscrita(res: Response, resource: string, err: unknown) {
  const codigo = (err as { code?: string }).code ?? "";
  if (codigo.startsWith("23")) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }
  console.error(`[resource] falha ao gravar em ${resource}:`, err);
  res.status(400).json({ error: "não foi possível gravar os dados enviados" });
}

function getResourceOr404(req: Request, res: Response) {
  const info = catalog.get(req.params.resource);
  if (!info) {
    res.status(404).json({ error: `recurso desconhecido: ${req.params.resource}` });
    return null;
  }
  return info;
}

export const resourceRouter = Router();

// GET /api/:resource -- lista paginada, com filtro opcional por coluna=valor
resourceRouter.get("/:resource", enforceMenuPermission("perm_leitura", "resource"), async (req, res) => {
  await ensureCatalogLoaded();
  const info = getResourceOr404(req, res);
  if (!info) return;

  const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const filterEntries = Object.entries(req.query).filter(
    ([key]) => !["limit", "offset"].includes(key) && info.columns.includes(key)
  );

  const whereSql = filterEntries.length
    ? "WHERE " + filterEntries.map(([key], i) => `${quoteIdent(key)} = $${i + 1}`).join(" AND ")
    : "";
  const baseParams = filterEntries.map(([, value]) => value as string);

  // dados e contagem total não dependem um do outro -- rodar em paralelo em vez de sequencial
  // corta pela metade a latência de rede até o Postgres em cada listagem.
  const [{ rows }, { rows: totalRows }] = await Promise.all([
    query(
      `SELECT * FROM ${quoteIdent(info.name)} ${whereSql} LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
      [...baseParams, limit, offset]
    ),
    query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${quoteIdent(info.name)} ${whereSql}`, baseParams),
  ]);

  res.json({ data: redactRows(info.name, rows as Record<string, unknown>[]), total: totalRows[0].n, limit, offset });
});

// GET /api/:resource/:id -- só pra tabelas com PK
resourceRouter.get("/:resource/:id", enforceMenuPermission("perm_leitura", "resource"), async (req, res) => {
  await ensureCatalogLoaded();
  const info = getResourceOr404(req, res);
  if (!info) return;
  if (!info.pk) {
    res.status(400).json({ error: `${info.name} é uma view, sem PK -- use GET /:resource com filtro` });
    return;
  }

  const { rows } = await query(
    `SELECT * FROM ${quoteIdent(info.name)} WHERE ${quoteIdent(info.pk)} = $1`,
    [req.params.id]
  );

  if (!rows[0]) {
    res.status(404).json({ error: "registro não encontrado" });
    return;
  }
  res.json(redactRow(info.name, rows[0] as Record<string, unknown>));
});

// POST /api/:resource -- insere (só tabelas)
resourceRouter.post("/:resource", enforceMenuPermission("perm_insercao", "resource"), async (req, res) => {
  await ensureCatalogLoaded();
  const info = getResourceOr404(req, res);
  if (!info) return;
  if (info.kind !== "table") {
    res.status(400).json({ error: `${info.name} é uma view, somente leitura` });
    return;
  }

  const entries = Object.entries(req.body ?? {}).filter(
    ([key]) => info.columns.includes(key) && isWritable(info.name, key)
  );
  if (!entries.length) {
    res.status(400).json({ error: "corpo vazio ou sem colunas válidas" });
    return;
  }

  const erroDom = erroDominio(info.name, entries);
  if (erroDom) {
    res.status(400).json({ error: erroDom });
    return;
  }

  const cols = entries.map(([key]) => quoteIdent(key)).join(", ");
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
  const values = entries.map(([, value]) => value as string | number | null);

  try {
    const { rows } = await query(
      `INSERT INTO ${quoteIdent(info.name)} (${cols}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    res.status(201).json(rows[0] ? redactRow(info.name, rows[0] as Record<string, unknown>) : { ok: true });
  } catch (err) {
    responderErroEscrita(res, info.name, err);
  }
});

// PUT /api/:resource/:id -- atualiza (só tabelas)
resourceRouter.put("/:resource/:id", enforceMenuPermission("perm_edicao", "resource"), async (req, res) => {
  await ensureCatalogLoaded();
  const info = getResourceOr404(req, res);
  if (!info) return;
  if (info.kind !== "table") {
    res.status(400).json({ error: `${info.name} é uma view, somente leitura` });
    return;
  }
  if (!info.pk) {
    res.status(400).json({ error: `${info.name} não tem PK definida` });
    return;
  }

  const entries = Object.entries(req.body ?? {}).filter(
    ([key]) => info.columns.includes(key) && key !== info.pk && isWritable(info.name, key)
  );
  if (!entries.length) {
    res.status(400).json({ error: "corpo vazio ou sem colunas válidas" });
    return;
  }

  const erroDom = erroDominio(info.name, entries);
  if (erroDom) {
    res.status(400).json({ error: erroDom });
    return;
  }

  const setSql = entries.map(([key], i) => `${quoteIdent(key)} = $${i + 1}`).join(", ");
  const values = entries.map(([, value]) => value as string | number | null);

  try {
    const { rows, rowCount } = await query(
      `UPDATE ${quoteIdent(info.name)} SET ${setSql} WHERE ${quoteIdent(info.pk)} = $${values.length + 1} RETURNING *`,
      [...values, req.params.id]
    );

    if (rowCount === 0) {
      res.status(404).json({ error: "registro não encontrado" });
      return;
    }
    res.json(redactRow(info.name, rows[0] as Record<string, unknown>));
  } catch (err) {
    responderErroEscrita(res, info.name, err);
  }
});

// DELETE /api/:resource/:id -- remove (só tabelas)
resourceRouter.delete("/:resource/:id", enforceMenuPermission("perm_exclusao", "resource"), async (req, res) => {
  await ensureCatalogLoaded();
  const info = getResourceOr404(req, res);
  if (!info) return;
  if (info.kind !== "table") {
    res.status(400).json({ error: `${info.name} é uma view, somente leitura` });
    return;
  }
  if (!info.pk) {
    res.status(400).json({ error: `${info.name} não tem PK definida` });
    return;
  }

  const { rowCount } = await query(
    `DELETE FROM ${quoteIdent(info.name)} WHERE ${quoteIdent(info.pk)} = $1`,
    [req.params.id]
  );

  if (rowCount === 0) {
    res.status(404).json({ error: "registro não encontrado" });
    return;
  }
  res.status(204).send();
});
