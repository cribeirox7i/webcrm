import evertecLogo from "../assets/evertec-logo.png";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

interface SidebarProps {
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
  footer?: React.ReactNode;
  /** Sobrescreve a logo padrão (Parâmetros Gerais > logo fundo escuro, no Admin) -- cai
   * pro asset embutido do bundle quando não configurada. */
  logoUrl?: string | null;
  /** Estado do drawer no celular (ignorado em desktop, onde a sidebar é sempre visível --
   * ver `@media (max-width: 767px)` no index.css). `onClose` fecha ao selecionar um item ou
   * ao tocar no fundo escurecido atrás do drawer. */
  mobileOpen?: boolean;
  onClose?: () => void;
}

export type { NavItem };

export function Sidebar({ items, active, onSelect, footer, logoUrl, mobileOpen, onClose }: SidebarProps) {
  function handleSelect(id: string) {
    onSelect(id);
    onClose?.();
  }

  return (
    <>
      {/* só existe no DOM quando o drawer está aberto -- em desktop `mobileOpen` nunca é true
          (App.tsx só liga isso quando `useIsMobile()` é true), então isto nunca renderiza lá. */}
      {mobileOpen && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <img src={logoUrl || evertecLogo} alt="Evertec" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav">
          {items.map((item) => {
            const childActive = item.children?.some((c) => c.id === active) ?? false;
            return (
              <div key={item.id}>
                <button
                  className={`sidebar-nav-item ${active === item.id || childActive ? "active" : ""}`}
                  onClick={() => handleSelect(item.id)}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  {item.label}
                </button>
                {item.children && (
                  <div className="sidebar-nav-children">
                    {item.children.map((child) => (
                      <button
                        key={child.id}
                        className={`sidebar-nav-item sidebar-nav-subitem ${active === child.id ? "active" : ""}`}
                        onClick={() => handleSelect(child.id)}
                      >
                        <span className="sidebar-nav-icon">{child.icon}</span>
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {footer}
        <a className="sidebar-admin-link" href="/admin">
          Administração
        </a>
      </aside>
    </>
  );
}
