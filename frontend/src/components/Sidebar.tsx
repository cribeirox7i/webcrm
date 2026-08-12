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
}

export type { NavItem };

export function Sidebar({ items, active, onSelect, footer, logoUrl }: SidebarProps) {
  return (
    <aside className="sidebar">
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
                onClick={() => onSelect(item.id)}
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
                      onClick={() => onSelect(child.id)}
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
  );
}
