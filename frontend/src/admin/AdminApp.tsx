import { useState } from "react";
import { AdminLoginPage } from "./AdminLoginPage";
import { UsuariosAdminPage } from "./UsuariosAdminPage";
import { CartMesAdminPage } from "./CartMesAdminPage";
import { ParametrosGeraisPage } from "./ParametrosGeraisPage";
import { ParametrosStoragePage } from "./ParametrosStoragePage";

const TOKEN_KEY = "webcrm_admin_token";

type AdminPage = "usuarios" | "carteira" | "parametros" | "armazenamento";

export function AdminApp() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [page, setPage] = useState<AdminPage>("usuarios");

  function handleLogin(newToken: string) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  if (!token) return <AdminLoginPage onLogin={handleLogin} />;

  return (
    <div className="admin-shell">
      <header className="app-topbar admin-topbar">
        <h1>Administração · WebCRM</h1>
        <nav className="admin-nav">
          <button className={page === "usuarios" ? "active" : ""} onClick={() => setPage("usuarios")}>
            Usuários
          </button>
          <button className={page === "carteira" ? "active" : ""} onClick={() => setPage("carteira")}>
            Carteira
          </button>
          <button className={page === "parametros" ? "active" : ""} onClick={() => setPage("parametros")}>
            Parâmetros
          </button>
          <button className={page === "armazenamento" ? "active" : ""} onClick={() => setPage("armazenamento")}>
            Armazenamento
          </button>
        </nav>
        <div className="admin-topbar-actions">
          <a href="/">&larr; Voltar para o CRM</a>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </header>
      <main>
        {page === "usuarios" && <UsuariosAdminPage token={token} onLogout={handleLogout} />}
        {page === "carteira" && <CartMesAdminPage token={token} onLogout={handleLogout} />}
        {page === "parametros" && <ParametrosGeraisPage token={token} onLogout={handleLogout} />}
        {page === "armazenamento" && <ParametrosStoragePage token={token} onLogout={handleLogout} />}
      </main>
    </div>
  );
}
