import { Request, Response, NextFunction } from "express";
import { db } from "./db";

// Mapeia o nome do recurso genérico (resource.ts, routes/anexos.ts, routes/propostaAnexo.ts)
// pro menu_key dono dele em usuarios_permissoes_menu -- várias tabelas podem pertencer ao
// mesmo menu (ex.: Financeiro cobre precos_cliente/carteira/faturamento). Recursos fora
// deste mapa (views, tabelas de referência tipo list_*, cart_mes) continuam sem essa
// checagem -- mesmo comportamento de antes, não é uma regressão nova.
const MENU_BY_RESOURCE: Record<string, string> = {
  clientes: "clientes",
  contatos: "contatos",
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

function temPermissao(userId: number, menuKey: string, campo: PermCampo): boolean {
  const row = db
    .prepare(`SELECT ${campo} AS v FROM usuarios_permissoes_menu WHERE user_id = ? AND menu_key = ?`)
    .get(userId, menuKey) as { v: number } | undefined;
  return !!row?.v;
}

/** Checagem pontual pra rotas dedicadas (anexos.ts, propostaAnexo.ts) cujo menu_key não dá
 * pra resolver só pelo nome do recurso (ex.: upload de anexo recebe cliente_id OU
 * fornecedor_id no corpo, cada um dono de um menu diferente). Devolve `true` e já manda a
 * resposta 401/403 se o pedido deve ser barrado -- chamador só precisa dar `return` nesse caso.
 * PIN de admin sempre passa direto, igual ao middleware genérico. */
export function bloqueado(req: Request, res: Response, menuKey: string, campo: PermCampo): boolean {
  if (req.isAdmin) return false;
  if (!req.usuario) {
    res.status(401).json({ error: "não autenticado" });
    return true;
  }
  if (!temPermissao(req.usuario.user_id, menuKey, campo)) {
    res.status(403).json({ error: "sem permissão para esta ação" });
    return true;
  }
  return false;
}

/** Bloqueia acesso (GET/POST/PUT/DELETE) em recursos genéricos quando o usuário logado não
 * tem a permissão granular correspondente pro menu dono daquele recurso. Até 2026-08-10,
 * usuarios_permissoes_menu só controlava o que a Sidebar mostra (perm_leitura no front) --
 * as 3 flags de escrita eram gravadas mas nunca checadas em lugar nenhum, front ou back
 * (achado real reportado pelo usuário: usuário só com Leitura em Servidores ainda
 * conseguia criar/editar/excluir pelos botões, que nem eram escondidos). Ficou faltando
 * a própria `perm_leitura` no GET até 2026-08-11 (achado numa auditoria de segurança:
 * qualquer sessão de usuário válida conseguia ler qualquer tabela via GET, mesmo sem
 * `perm_leitura` naquele menu -- só a Sidebar escondia a navegação, a API respondia
 * igual). PIN de admin sempre passa direto. `resourceParam` deixa reaproveitar em rotas
 * que não usam :resource na URL (anexos, proposta_anexo). */
export function enforceMenuPermission(campo: PermCampo, resourceParam: string | ((req: Request) => string)) {
  return (req: Request, res: Response, next: NextFunction) => {
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
    if (!temPermissao(req.usuario.user_id, menuKey, campo)) {
      res.status(403).json({ error: "sem permissão para esta ação" });
      return;
    }
    next();
  };
}
