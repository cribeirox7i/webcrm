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
  { key: "indices", label: "Índices" },
  { key: "projetos", label: "Projetos" },
  { key: "produtos", label: "Produtos" },
  { key: "servidores", label: "Servidores" },
  { key: "pessoas", label: "Pessoas" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "pagadoria", label: "Pagadoria" },
  // não é um item de navegação (sem NAV_ITEMS correspondente) -- controla se o botão "Planilha"
  // (link pra planilha analítica no Drive, em Carteira e no dashboard do cliente) e o botão
  // "Relatório" (PDF analítico de consumo, em Faturamento) ficam habilitados -- sem a permissão,
  // o botão continua visível, só desabilitado ("bloqueado", não "some"; decisão do usuário).
  // Só a permissão de Leitura tem efeito aqui; Inserção/Edição/Exclusão ficam sem uso, mesma
  // tabela genérica de permissões por menu.
  { key: "planilha_analitica", label: "Planilha e Relatório Analítico" },
];
