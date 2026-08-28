import type { Anexo, Proposta } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3101";

export interface ListResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

interface ApiError {
  error: string;
}

// Token da sessão de usuário (login do app principal) -- setado pelo AuthContext no
// login/logout. Todo pedido ao backend passa esse Bearer automaticamente; não precisa
// mais threadar "token" manualmente por página (diferente do adminClient.ts, que ainda
// recebe o token do PIN mestre por parâmetro, mecanismo independente).
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Chamado sempre que uma resposta 401 chega -- AuthContext usa isso pra deslogar
 * automaticamente quando a sessão expira ou é revogada em outra aba/dispositivo. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(`${API_URL}${path}`, { headers, ...options });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
    if (res.status === 401) onUnauthorized?.();
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  list: <T>(resource: string, params?: Record<string, string | number>) => {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    return request<ListResponse<T>>(`/api/${resource}${qs}`);
  },
  /** Igual a `list`, mas busca TODAS as páginas (respeitando o `total` devolvido pelo
   * backend) em vez de confiar que tudo cabe num único request de `limit` linhas --
   * necessário pra recursos que podem passar do MAX_LIMIT do backend (20 mil linhas/req),
   * como `consumo_ana` de um cliente com muita transação num mês. */
  listAll: async <T>(resource: string, params?: Record<string, string | number>): Promise<T[]> => {
    const pageSize = Number(params?.limit) || 20000;
    let offset = 0;
    const all: T[] = [];
    for (;;) {
      const pageParams = new URLSearchParams();
      Object.entries({ ...params, limit: pageSize, offset }).forEach(([k, v]) => pageParams.set(k, String(v)));
      const page = await request<ListResponse<T>>(`/api/${resource}?${pageParams.toString()}`);
      all.push(...page.data);
      offset += page.data.length;
      if (page.data.length === 0 || offset >= page.total) break;
    }
    return all;
  },
  get: <T>(resource: string, id: number | string) => request<T>(`/api/${resource}/${id}`),
  create: <T>(resource: string, body: Record<string, unknown>) =>
    request<T>(`/api/${resource}`, { method: "POST", body: JSON.stringify(body) }),
  update: <T>(resource: string, id: number | string, body: Record<string, unknown>) =>
    request<T>(`/api/${resource}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (resource: string, id: number | string) =>
    request<void>(`/api/${resource}/${id}`, { method: "DELETE" }),
  // indices_economicos tem PK composta (index_nome, index_ano, index_mes) -- rota dedicada no
  // backend (routes/indices.ts). PUT faz upsert, serve pra criar e editar.
  upsertIndice: <T>(nome: string, ano: number, mes: number, body: Record<string, unknown>) =>
    request<T>(`/api/indices_economicos/${encodeURIComponent(nome)}/${ano}/${mes}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  removeIndice: (nome: string, ano: number, mes: number) =>
    request<void>(`/api/indices_economicos/${encodeURIComponent(nome)}/${ano}/${mes}`, { method: "DELETE" }),
  /** Pede o link de download assinado de um anexo (backend gera via Cloud Storage,
   * expira em poucos minutos) -- não é o arquivo em si. */
  downloadAnexo: (id: number) => request<{ url: string }>(`/api/anexos/${id}/download`),
  /** Upload multipart -- não passa por `request()` porque precisa deixar o navegador
   * definir o Content-Type (multipart/form-data com boundary), diferente do JSON default. */
  uploadAnexo: async (formData: FormData): Promise<Anexo> => {
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const res = await fetch(`${API_URL}/api/anexos/upload`, { method: "POST", headers, body: formData });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
      if (res.status === 401) onUnauthorized?.();
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },
  /** Anexo único da proposta (coluna proposta_anexo) -- mesmo par upload/download do
   * anexo de Fornecedor/Cliente, só que a "lista" tem 1 item embutido na própria linha. */
  downloadPropostaAnexo: (id: number) => request<{ url: string }>(`/api/propostas/${id}/anexo/download`),
  uploadPropostaAnexo: async (id: number, formData: FormData): Promise<Proposta> => {
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const res = await fetch(`${API_URL}/api/propostas/${id}/anexo`, { method: "POST", headers, body: formData });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
      if (res.status === 401) onUnauthorized?.();
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },
  removePropostaAnexo: (id: number) => request<Proposta>(`/api/propostas/${id}/anexo`, { method: "DELETE" }),
};
