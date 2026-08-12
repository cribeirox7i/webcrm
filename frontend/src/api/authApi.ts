const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3101";

export interface UsuarioLogado {
  id: number;
  nome: string;
  email: string;
}

export interface LoginResponse {
  token: string;
  expiraEm: string;
  mustChangePassword: boolean;
  usuario: UsuarioLogado;
}

export interface PermissaoMenu {
  menu_key: string;
  perm_leitura: number;
  perm_insercao: number;
  perm_edicao: number;
  perm_exclusao: number;
}

interface ApiError {
  error: string;
}

async function request<T>(path: string, token: string | null, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const authApi = {
  login: (email: string, senha: string) =>
    request<LoginResponse>("/api/auth/login", null, { method: "POST", body: JSON.stringify({ email, senha }) }),
  esqueciSenha: (email: string) =>
    request<{ ok: true }>("/api/auth/esqueci-senha", null, { method: "POST", body: JSON.stringify({ email }) }),
  logout: (token: string) => request<void>("/api/auth/logout", token, { method: "POST" }),
  me: (token: string) =>
    request<{ usuario: UsuarioLogado; mustChangePassword: boolean }>("/api/auth/me", token),
  minhasPermissoes: (token: string) => request<PermissaoMenu[]>("/api/auth/minhas-permissoes", token),
  trocarSenha: (token: string, senhaAtual: string, novaSenha: string) =>
    request<void>("/api/auth/trocar-senha", token, {
      method: "POST",
      body: JSON.stringify({ senhaAtual, novaSenha }),
    }),
  convite: (conviteToken: string) =>
    request<{ nome: string; email: string }>(`/api/auth/convite/${conviteToken}`, null),
  definirSenha: (conviteToken: string, novaSenha: string) =>
    request<LoginResponse>(`/api/auth/convite/${conviteToken}/definir-senha`, null, {
      method: "POST",
      body: JSON.stringify({ novaSenha }),
    }),
};
