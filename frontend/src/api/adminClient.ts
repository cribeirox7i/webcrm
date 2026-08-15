const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3101";

export interface AdminListResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

interface ApiError {
  error: string;
}

export interface ParametroStorageMenu {
  menu_key: string;
  pasta: string;
}

/** Uma linha da planilha de medição, já mapeada pelas colunas (ver ImportarCarteiraPage). */
export interface LinhaMedicao {
  nome: string | null;
  cnpj: string | null;
  qtd: unknown;
  vlr: unknown;
  pdd: unknown;
  semPdd: unknown;
  fat: unknown;
  qtdMes: unknown;
  emprestimosMes: unknown;
  ultDef: unknown;
  dataBase: unknown;
  datExtracao: unknown;
  rds: string | null;
  db: string | null;
  prod: string | null;
}

export interface RelatorioImportacao {
  simulado: boolean;
  mes: string;
  linhasNaPlanilha: number;
  aInserir: number;
  porCnpj: number;
  porNome: { indice: number; nome: string; cnpj: string; clienteId: number; clienteNome: string }[];
  porDatabase: { indice: number; nome: string; db: string; clienteId: number; clienteNome: string }[];
  ignorados: { indice: number; nome: string; cnpj: string; db: string; motivo: string }[];
  linhasExistentesNoMes: number;
  inseridos?: number;
  apagados?: number;
  /** Só vem na simulação -- usada pra montar o dropdown de correção manual. */
  clientes?: { cliente_id: number; cliente_nome: string }[];
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

export const adminApi = {
  login: (pin: string) =>
    request<{ token: string }>("/api/admin/login", null, { method: "POST", body: JSON.stringify({ pin }) }),
  meta: (token: string) =>
    request<{ name: string; kind: "table" | "view"; columns: string[]; pk: string | null }[]>("/api/_meta", token),
  list: <T>(resource: string, token: string, params?: Record<string, string | number>) => {
    const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
    return request<AdminListResponse<T>>(`/api/${resource}${qs}`, token);
  },
  getOne: <T>(resource: string, token: string, id: number | string) => request<T>(`/api/${resource}/${id}`, token),
  create: <T>(resource: string, token: string, body: Record<string, unknown>) =>
    request<T>(`/api/${resource}`, token, { method: "POST", body: JSON.stringify(body) }),
  update: <T>(resource: string, token: string, id: number | string, body: Record<string, unknown>) =>
    request<T>(`/api/${resource}/${id}`, token, { method: "PUT", body: JSON.stringify(body) }),
  remove: (resource: string, token: string, id: number | string) =>
    request<void>(`/api/${resource}/${id}`, token, { method: "DELETE" }),
  // POST /api/usuarios/:id/convite -- gera link de "definir senha" e tenta enviar por e-mail
  // (se SMTP não estiver configurado no backend, `enviado` volta false e o link serve
  // pra copiar manualmente).
  enviarConvite: (token: string, userId: number) =>
    request<{ enviado: boolean; link: string; expiraEm: string }>(`/api/usuarios/${userId}/convite`, token, {
      method: "POST",
    }),
  // PUT /api/usuarios/:id/senha -- admin define a senha de login direto (sem passar pelo
  // convite por e-mail); revoga as sessões abertas do usuário no backend.
  definirSenha: (token: string, userId: number, novaSenha: string) =>
    request<void>(`/api/usuarios/${userId}/senha`, token, {
      method: "PUT",
      body: JSON.stringify({ novaSenha }),
    }),
  // parametros_storage_menu: pasta (dentro do bucket do Supabase Storage) usada por cada
  // menu com upload de anexo -- rota dedicada (não é PK composta, mas é admin-only, fora
  // do padrão de sessão de usuário do resourceRouter genérico).
  listParametrosStorage: (token: string) => request<ParametroStorageMenu[]>("/api/parametros_storage_menu", token),
  updateParametroStorage: (token: string, menuKey: string, pasta: string) =>
    request<ParametroStorageMenu>(`/api/parametros_storage_menu/${encodeURIComponent(menuKey)}`, token, {
      method: "PUT",
      body: JSON.stringify({ pasta }),
    }),
  // importação da planilha de medição -> carteira. Sempre chamada 2x: `simular: true` devolve o
  // relatório sem gravar nada, e só depois da confirmação do usuário vai com `simular: false`.
  // `correcoes` é { índice da linha na planilha -> cliente_id } pras linhas em que o usuário não
  // concordou com o cliente escolhido pela heurística (CNPJ ambíguo / achado pelo database).
  importarCarteira: (
    token: string,
    cartMesId: number,
    linhas: LinhaMedicao[],
    simular: boolean,
    correcoes?: Record<number, number>
  ) =>
    request<RelatorioImportacao>("/api/admin/importar-carteira", token, {
      method: "POST",
      body: JSON.stringify({ cartMesId, linhas, simular, correcoes }),
    }),
  // usuarios_permissoes_menu tem PK composta (user_id, menu_key) -- usa rota dedicada do backend
  updatePermissaoMenu: <T>(
    token: string,
    userId: number,
    menuKey: string,
    perms: { perm_leitura: boolean; perm_insercao: boolean; perm_edicao: boolean; perm_exclusao: boolean }
  ) =>
    request<T>(`/api/usuarios_permissoes_menu/${userId}/${encodeURIComponent(menuKey)}`, token, {
      method: "PUT",
      body: JSON.stringify(perms),
    }),
};
