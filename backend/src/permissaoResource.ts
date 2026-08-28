import { Request, Response, NextFunction } from "express";
import { query } from "./db";

// Mapeia o nome do recurso genérico (resource.ts, routes/anexos.ts, routes/propostaAnexo.ts)
// pro menu_key dono dele em usuarios_permissoes_menu -- várias tabelas podem pertencer ao
// mesmo menu (ex.: Financeiro cobre precos_cliente/carteira/faturamento).
//
// IMPORTANTE: este mapa é a whitelist do roteador genérico. Recurso que não está nem aqui
// nem em REFERENCIA_SOMENTE_LEITURA é NEGADO (403) -- ver enforceMenuPermission. Antes era o
// contrário (recurso não mapeado passava direto), e isso expunha `usuario_sessoes` -- a tabela
// de tokens de sessão -- a qualquer usuário autenticado, permitindo assumir a identidade de
// outra conta. Ao adicionar tabela/view nova no schema, mapear aqui (ou na lista de referência
// abaixo) senão a tela nova responde 403.
const MENU_BY_RESOURCE: Record<string, string> = {
  clientes: "clientes",
  cliente_flags_produtos: "clientes",
  cliente_flags_resumo: "clientes",
  contatos: "contatos",
  grupos_econ: "grupos_econ",
  propostas: "propostas",
  urls: "urls",
  servidores: "servidores",
  produtos: "produtos",
  pessoas: "pessoas",
  pessoas_detalhe: "pessoas",
  fornecedores: "fornecedores",
  forn_contratos: "fornecedores",
  forn_pagadoria: "pagadoria",
  anexos: "fornecedores",
  precos_cliente: "financeiro",
  precos_cliente_mes_atual: "financeiro",
  carteira: "financeiro",
  // cart_mes só é escrito pela aba Carteira do Admin (PIN, que passa direto por este
  // middleware); no app principal é leitura, e a tela de cliente já checa Financeiro.
  cart_mes: "financeiro",
  cart_mes_resumo: "financeiro",
  consumo_ana: "financeiro",
  faturamento: "financeiro",
  faturamento_detalhe: "financeiro",
  indices_economicos: "indices",
  indices_calculados: "indices",
  portfolios: "projetos",
  portfolios_progresso: "projetos",
  crono: "projetos",
  crono_calculado: "projetos",
};

// Tabelas de lookup/referência que qualquer usuário autenticado pode LER (alimentam dropdowns
// de formulário em várias telas, não têm dado sensível nem de negócio). Escrita continua
// exigindo PIN de admin -- não existe tela pra isso hoje, os valores são mantidos via SQL.
const REFERENCIA_SOMENTE_LEITURA = new Set(["list_resp_crono", "list_url_status", "list_tip_resp"]);

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
 * passa direto. `resourceParam` deixa reaproveitar em rotas que não usam :resource na URL.
 *
 * Nega por padrão: recurso sem menu mapeado e fora de REFERENCIA_SOMENTE_LEITURA responde 403,
 * mesmo pra usuário autenticado. */
export function enforceMenuPermission(campo: PermCampo, resourceParam: string | ((req: Request) => string)) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.isAdmin) {
      next();
      return;
    }
    if (!req.usuario) {
      res.status(401).json({ error: "não autenticado" });
      return;
    }
    const resource = typeof resourceParam === "function" ? resourceParam(req) : req.params[resourceParam];
    // Object.hasOwn, não `MENU_BY_RESOURCE[resource]` direto: `resource` vem da URL, e um
    // nome herdado do prototype ("toString", "constructor") devolveria uma função como se
    // fosse um menu_key válido.
    const menuKey = Object.hasOwn(MENU_BY_RESOURCE, resource) ? MENU_BY_RESOURCE[resource] : undefined;
    if (!menuKey) {
      if (campo === "perm_leitura" && REFERENCIA_SOMENTE_LEITURA.has(resource)) {
        next();
        return;
      }
      res.status(403).json({ error: "sem permissão para esta ação" });
      return;
    }
    if (!(await temPermissao(req.usuario.user_id, menuKey, campo))) {
      res.status(403).json({ error: "sem permissão para esta ação" });
      return;
    }
    next();
  };
}
