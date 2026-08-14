import { Request, Response, NextFunction } from "express";
import { query } from "./db";

// Mapeia o nome do recurso genérico (resource.ts, routes/anexos.ts, routes/propostaAnexo.ts)
// pro menu_key dono dele em usuarios_permissoes_menu -- várias tabelas podem pertencer ao
// mesmo menu (ex.: Financeiro cobre precos_cliente/carteira/faturamento). Recursos fora
// deste mapa (views, tabelas de referência tipo list_*, cart_mes) continuam sem essa
// checagem -- mesmo comportamento de antes, não é uma regressão nova.
const MENU_BY_RESOURCE: Record<string, string> = {
  clientes: "clientes",
  contatos: "contatos",
  grupos_econ: "grupos_econ",
  propostas: "propostas",
  urls: "urls",
  servidores: "servidores",
  produtos: "produtos",
  pessoas: "pessoas",
  fornecedores: "fornecedores",
  forn_contratos: "fornecedores",
  forn_pagadoria: "pagadoria",
  anexos: "fornecedores",
  precos_cliente: "financeiro",
  carteira: "financeiro",
  faturamento: "financeiro",
  portfolios: "projetos",
  crono: "projetos",
};

type PermCampo = "perm_leitura" | "perm_insercao" | "perm_edicao" | "perm_exclusao";

// `campo` é restrito ao union type acima e nunca recebe valor de request/query em nenhum
// call site (todos os chamadores passam literal de string fixo) -- ainda assim, validado
// contra a lista real de colunas aqui, não confiando só na checagem estática do TypeScript
// (que é erased em runtime), antes de interpolar no SELECT.
const CAMPOS_VALIDOS: PermCampo[] = ["perm_leitura", "perm_insercao", "perm_edicao", "perm_exclusao"];

async function temPermissao(userId: number, menuKey: string, campo: PermCampo): Promise<boolean> {
  if (!CAMPOS_VALIDOS.includes(campo)) {
    throw new Error(`campo de permissão inválido: ${campo}`);
  }
  const { rows } = await query<{ v: number }>(
    `SELECT ${campo} AS v FROM usuarios_permissoes_menu WHERE user_id = $1 AND menu_key = $2`,
    [userId, menuKey]
  );
  return !!rows[0]?.v;
}

/** Checagem pontual pra rotas dedicadas (anexos.ts, propostaAnexo.ts) cujo menu_key não dá
 * pra resolver só pelo nome do recurso (ex.: upload de anexo recebe cliente_id OU
 * fornecedor_id no corpo, cada um dono de um menu diferente). Devolve `true` e já manda a
 * resposta 401/403 se o pedido deve ser barrado -- chamador só precisa dar `return` nesse caso.
 * PIN de admin sempre passa direto, igual ao middleware genérico. */
export async function bloqueado(req: Request, res: Response, menuKey: string, campo: PermCampo): Promise<boolean> {
  if (req.isAdmin) return false;
  if (!req.usuario) {
    res.status(401).json({ error: "não autenticado" });
    return true;
  }
  if (!(await temPermissao(req.usuario.user_id, menuKey, campo))) {
    res.status(403).json({ error: "sem permissão para esta ação" });
    return true;
  }
  return false;
}

/** Bloqueia acesso (GET/POST/PUT/DELETE) em recursos genéricos quando o usuário logado não
 * tem a permissão granular correspondente pro menu dono daquele recurso. PIN de admin sempre
 * passa direto. `resourceParam` deixa reaproveitar em rotas que não usam :resource na URL. */
export function enforceMenuPermission(campo: PermCampo, resourceParam: string | ((req: Request) => string)) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.isAdmin) {
      next();
      return;
    }
    const resource = typeof resourceParam === "function" ? resourceParam(req) : req.params[resourceParam];
    const menuKey = MENU_BY_RESOURCE[resource];
    if (!menuKey) {
      next();
      return;
    }
    if (!req.usuario) {
      res.status(401).json({ error: "não autenticado" });
      return;
    }
    if (!(await temPermissao(req.usuario.user_id, menuKey, campo))) {
      res.status(403).json({ error: "sem permissão para esta ação" });
      return;
    }
    next();
  };
}
