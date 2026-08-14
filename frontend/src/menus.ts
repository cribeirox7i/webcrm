export interface MenuDef {
  key: string;
  label: string;
}

/** Lista canônica de menus do sistema -- usada pela navegação (App.tsx/Sidebar) e pela tela
 * de permissões por menu no Admin. As chaves batem com os ids usados em App.tsx (NAV_ITEMS). */
export const MENUS: MenuDef[] = [
  { key: "clientes", label: "Clientes" },
  { key: "contatos", label: "Contatos" },
  { key: "grupos_econ", label: "Grupos Econômicos" },
  { key: "propostas", label: "Propostas" },
  { key: "urls", label: "URLs" },
  { key: "financeiro", label: "Financeiro" },
  { key: "projetos", label: "Projetos" },
  { key: "produtos", label: "Produtos" },
  { key: "servidores", label: "Servidores" },
  { key: "pessoas", label: "Pessoas" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "pagadoria", label: "Pagadoria" },
];
