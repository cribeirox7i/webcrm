import { useEffect, useMemo, useState } from "react";
import { PageTitleContext } from "./PageTitleContext";
import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./auth/LoginPage";
import { TrocarSenhaPage } from "./auth/TrocarSenhaPage";
import { ClientesPage } from "./components/ClientesPage";
import { ClienteDashboardPage } from "./components/ClienteDashboardPage";
import { UrlsPage } from "./components/UrlsPage";
import { ContatosPage } from "./components/ContatosPage";
import { ProdutosPage } from "./components/ProdutosPage";
import { ServidoresPage } from "./components/ServidoresPage";
import { PessoasPage } from "./components/PessoasPage";
import { FornecedoresPage } from "./components/FornecedoresPage";
import { FornecedorDashboardPage } from "./components/FornecedorDashboardPage";
import { PagadoriaPage } from "./components/PagadoriaPage";
import { PropostasPage } from "./components/PropostasPage";
import { FinanceiroPage } from "./components/FinanceiroPage";
import { PortfolioPage } from "./components/PortfolioPage";
import { Sidebar, type NavItem } from "./components/Sidebar";
import { getParametrosGerais } from "./lib/parametros";
import {
  ClientesIcon,
  UrlsIcon,
  ContatosIcon,
  ProdutosIcon,
  ServidoresIcon,
  PessoasIcon,
  FornecedoresIcon,
  FinanceiroIcon,
  ProjetosIcon,
  WalletIcon,
  PropostasIcon,
} from "./components/icons";

type Tab =
  | "clientes"
  | "urls"
  | "contatos"
  | "propostas"
  | "produtos"
  | "servidores"
  | "pessoas"
  | "fornecedores"
  | "pagadoria"
  | "financeiro"
  | "projetos";

const NAV_ITEMS: NavItem[] = [
  {
    id: "clientes",
    label: "Clientes",
    icon: <ClientesIcon />,
    children: [
      { id: "contatos", label: "Contatos", icon: <ContatosIcon /> },
      { id: "propostas", label: "Propostas", icon: <PropostasIcon /> },
    ],
  },
  {
    id: "urls",
    label: "URLs",
    icon: <UrlsIcon />,
    children: [{ id: "servidores", label: "Servidores", icon: <ServidoresIcon /> }],
  },
  { id: "financeiro", label: "Financeiro", icon: <FinanceiroIcon /> },
  { id: "projetos", label: "Projetos", icon: <ProjetosIcon /> },
  { id: "produtos", label: "Produtos", icon: <ProdutosIcon /> },
  { id: "pessoas", label: "Pessoas", icon: <PessoasIcon /> },
  {
    id: "fornecedores",
    label: "Fornecedores",
    icon: <FornecedoresIcon />,
    children: [{ id: "pagadoria", label: "Pagadoria", icon: <WalletIcon /> }],
  },
];

const TITLES: Record<Tab, string> = {
  clientes: "Clientes",
  urls: "URLs",
  contatos: "Contatos",
  propostas: "Propostas",
  produtos: "Produtos",
  servidores: "Servidores",
  pessoas: "Pessoas",
  fornecedores: "Fornecedores",
  pagadoria: "Pagadoria",
  financeiro: "Financeiro",
  projetos: "Projetos",
};

function App() {
  const { loading, usuario, mustChangePassword, menusPermitidos, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("clientes");
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedFornecedorId, setSelectedFornecedorId] = useState<number | null>(null);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [logoEscuroUrl, setLogoEscuroUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    getParametrosGerais().then((params) => setLogoEscuroUrl(params.param_logo_escuro_url));
  }, [usuario]);

  const navItems = useMemo(() => {
    if (!menusPermitidos) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => menusPermitidos.has(item.id)).map((item) =>
      item.children ? { ...item, children: item.children.filter((c) => menusPermitidos.has(c.id)) } : item
    );
  }, [menusPermitidos]);

  useEffect(() => {
    if (!menusPermitidos || menusPermitidos.has(tab)) return;
    const primeiroPermitido = navItems[0];
    if (primeiroPermitido) setTab(primeiroPermitido.id as Tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menusPermitidos]);

  function handleSelect(id: string) {
    setTab(id as Tab);
    setPageTitle(null);
    if (id === "clientes") setSelectedClienteId(null);
    if (id === "fornecedores") setSelectedFornecedorId(null);
  }

  if (loading) return null;
  if (!usuario) return <LoginPage />;
  if (mustChangePassword) return <TrocarSenhaPage />;

  if (navItems.length === 0) {
    return (
      <div className="admin-login-shell">
        <div className="admin-login-card">
          <h1>Sem acesso a nenhuma tela</h1>
          <p className="page-subtitle">
            {usuario.nome}, seu usuário ainda não tem permissão de leitura em nenhum menu. Fale com o
            administrador do sistema.
          </p>
          <button onClick={logout}>Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        items={navItems}
        active={tab}
        onSelect={handleSelect}
        logoUrl={logoEscuroUrl}
        footer={
          <div className="sidebar-user">
            <span className="sidebar-user-nome">{usuario.nome}</span>
            <button className="sidebar-user-logout" onClick={logout}>
              Sair
            </button>
          </div>
        }
      />
      <div className="app-content">
        <header className="app-topbar">
          <h1>{pageTitle ?? TITLES[tab]}</h1>
        </header>
        <main>
          <PageTitleContext.Provider value={setPageTitle}>
            {tab === "clientes" &&
              (selectedClienteId != null ? (
                <ClienteDashboardPage clienteId={selectedClienteId} onBack={() => setSelectedClienteId(null)} />
              ) : (
                <ClientesPage onOpenCliente={setSelectedClienteId} />
              ))}
            {tab === "urls" && <UrlsPage />}
            {tab === "contatos" && <ContatosPage />}
            {tab === "propostas" && <PropostasPage />}
            {tab === "produtos" && <ProdutosPage />}
            {tab === "servidores" && <ServidoresPage />}
            {tab === "pessoas" && <PessoasPage />}
            {tab === "fornecedores" &&
              (selectedFornecedorId != null ? (
                <FornecedorDashboardPage fornecedorId={selectedFornecedorId} onBack={() => setSelectedFornecedorId(null)} />
              ) : (
                <FornecedoresPage onOpenFornecedor={setSelectedFornecedorId} />
              ))}
            {tab === "pagadoria" && <PagadoriaPage />}
            {tab === "financeiro" && <FinanceiroPage />}
            {tab === "projetos" && <PortfolioPage />}
          </PageTitleContext.Provider>
        </main>
      </div>
    </div>
  );
}

export default App;
