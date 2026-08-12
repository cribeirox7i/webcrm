import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, type UsuarioLogado } from "../api/authApi";
import { setAuthToken, setUnauthorizedHandler } from "../api/client";

const STORAGE_KEY = "webcrm_token";

export interface PermissaoFlags {
  leitura: boolean;
  insercao: boolean;
  edicao: boolean;
  exclusao: boolean;
}

interface AuthState {
  loading: boolean;
  token: string | null;
  usuario: UsuarioLogado | null;
  mustChangePassword: boolean;
  /** Permissão completa (4 flags) por menu_key -- null enquanto ainda não carregou (evita
   * a Sidebar/botões "piscarem" mostrando tudo antes da resposta chegar). */
  permissoes: Map<string, PermissaoFlags> | null;
  /** Derivado de `permissoes` (menu_key com perm_leitura) -- mantido separado porque é o
   * formato que a Sidebar/App.tsx já consomem pra filtrar NAV_ITEMS. */
  menusPermitidos: Set<string> | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  onSenhaTrocada: () => void;
  /** Usado pela tela de "definir senha" via link de convite -- a API de convite já
   * devolve token+usuário prontos (login automático), só precisa aplicar no contexto. */
  applySessao: (token: string, usuario: UsuarioLogado, mustChangePassword: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function carregarPermissoes(token: string): Promise<Map<string, PermissaoFlags>> {
  const permissoes = await authApi.minhasPermissoes(token).catch(() => []);
  const map = new Map<string, PermissaoFlags>();
  permissoes.forEach((p) =>
    map.set(p.menu_key, {
      leitura: !!p.perm_leitura,
      insercao: !!p.perm_insercao,
      edicao: !!p.perm_edicao,
      exclusao: !!p.perm_exclusao,
    })
  );
  return map;
}

function menusPermitidosDe(permissoes: Map<string, PermissaoFlags>): Set<string> {
  return new Set([...permissoes].filter(([, f]) => f.leitura).map(([k]) => k));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    token: null,
    usuario: null,
    mustChangePassword: false,
    permissoes: null,
    menusPermitidos: null,
  });

  const logout = useCallback(() => {
    setState((prev) => {
      if (prev.token) authApi.logout(prev.token).catch(() => {}); // best-effort
      return prev;
    });
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setState({ loading: false, token: null, usuario: null, mustChangePassword: false, permissoes: null, menusPermitidos: null });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    setAuthToken(stored);
    authApi
      .me(stored)
      .then(async ({ usuario, mustChangePassword }) => {
        const permissoes = await carregarPermissoes(stored);
        setState({ loading: false, token: stored, usuario, mustChangePassword, permissoes, menusPermitidos: menusPermitidosDe(permissoes) });
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setAuthToken(null);
        setState({ loading: false, token: null, usuario: null, mustChangePassword: false, permissoes: null, menusPermitidos: null });
      });
  }, []);

  async function login(email: string, senha: string) {
    const res = await authApi.login(email, senha);
    localStorage.setItem(STORAGE_KEY, res.token);
    setAuthToken(res.token);
    const permissoes = await carregarPermissoes(res.token);
    setState({
      loading: false,
      token: res.token,
      usuario: res.usuario,
      mustChangePassword: res.mustChangePassword,
      permissoes,
      menusPermitidos: menusPermitidosDe(permissoes),
    });
  }

  function onSenhaTrocada() {
    setState((prev) => ({ ...prev, mustChangePassword: false }));
  }

  async function applySessao(token: string, usuario: UsuarioLogado, mustChangePassword: boolean) {
    localStorage.setItem(STORAGE_KEY, token);
    setAuthToken(token);
    const permissoes = await carregarPermissoes(token);
    setState({ loading: false, token, usuario, mustChangePassword, permissoes, menusPermitidos: menusPermitidosDe(permissoes) });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, onSenhaTrocada, applySessao }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
