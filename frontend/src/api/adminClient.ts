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

// Um contrato (precos_cliente) candidato a reajuste, já com o valor novo calculado (ver
// backend/src/routes/adminReajuste.ts) -- status decide se o checkbox nasce marcado/desabilitado
// na tela de simulação.
export interface CandidatoReajuste {
  pc_id: number;
  cliente_id: number;
  cliente_nome: string;
  cliente_cnpj: string | null;
  produto_id: number;
  produto_nome: string;
  produto_detalhe: string | null;
  pc_dat_niver: string;
  pc_cod_index: string | null;
  index_ano: number;
  index_mes: number;
  index_acum_12m: number | null;
  vlr_unit_atual: number | null;
  vlr_unit_novo: number | null;
  vlr_franquia_atual: number | null;
  vlr_franquia_novo: number | null;
  status: "aplicavel" | "sem_indexador" | "sem_indice_mes_corrente" | "acumulado_negativo" | "ja_aplicado";
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

/** Uma linha de { nome do arquivo .xlsx, URL da planilha no Drive } vinda do txt/csv que o
 * usuário exporta manualmente da pasta do Drive (sem integração com a API do Drive -- ver
 * ImportarCarteiraModal, que já normaliza um id solto pra URL completa antes de chegar aqui). */
export interface PlanilhaAnalitica {
  nome: string;
  url: string;
}

export interface RelatorioImportacao {
  simulado: boolean;
  mes: string;
  linhasNaPlanilha: number;
  aInserir: number;
  porCnpj: number;
  porNome: { indice: number; nome: string; cnpj: string; clienteId: number; clienteNome: string }[];
  porDatabase: { indice: number; nome: string; db: string; clienteId: number; clienteNome: string }[];
  ignorados: {
    indice: number;
    nome: string;
    cnpj: string;
    db: string;
    motivo: string;
    clienteIdSugerido?: number;
    clienteNomeSugerido?: string;
  }[];
  // linhas que serão gravadas mas não bateram com nenhum nome da lista de planilhas enviada --
  // só vem preenchido quando uma lista foi de fato enviada (ver ImportarCarteiraModal).
  semPlanilha: { indice: number; nome: string; nomePlanilhaEsperado: string }[];
  linhasExistentesNoMes: number;
  inseridos?: number;
  apagados?: number;
  /** Só vem na simulação -- usada pra montar o dropdown de correção manual. */
  clientes?: { cliente_id: number; cliente_nome: string }[];
}

/** Uma linha de um dos arquivos de consumo analítico (xlsx ou csv, mesmo layout), já mapeada
 * pelas colunas (ver ImportarConsumoModal). Vários arquivos são lidos e concatenados no
 * navegador antes de mandar pra cá -- o backend não sabe de qual arquivo cada linha veio. */
export interface LinhaConsumo {
  idProduto: unknown;
  cnpj: string | null;
  data: unknown;
  quantidade: unknown;
  detalhamento: string | null;
}

export interface RelatorioImportacaoConsumo {
  simulado: boolean;
  mes: string;
  linhasNaPlanilha: number;
  aInserir: number;
  clientesDistintos: number;
  // agrupado por CNPJ (não por linha) -- um CNPJ se repete em dezenas/centenas de linhas neste
  // arquivo. `candidatos` vem preenchido só quando o CNPJ é ambíguo (mais de 1 cliente
  // cadastrado com o mesmo CNPJ); vazio quando simplesmente não existe cliente com esse CNPJ.
  cnpjsPendentes: { cnpj: string; linhas: number; candidatos: { cliente_id: number; cliente_nome: string }[] }[];
  // agrupado por ID_Produto (texto original do arquivo).
  produtosPendentes: { idProduto: string; linhas: number }[];
  // de onde vêm as linhas de precos_cliente que serão duplicadas pro mês da carga -- null quando
  // não existe nenhum outro mês com preço cadastrado ainda (primeira carga do sistema).
  precosOrigem: { cartMesId: number; anoMes: string; linhas: number } | null;
  consumoExistenteNoMes: number;
  precosExistentesNoMes: number;
  faturamentoExistenteNoMes: number;
  /** Só vem na simulação -- dropdowns de correção manual. */
  clientes?: { cliente_id: number; cliente_nome: string }[];
  produtos?: { produto_id: number; produto_nome: string }[];
  // só na confirmação (simulado: false)
  consumoInseridos?: number;
  consumoApagados?: number;
  precosDuplicados?: number;
  precosApagados?: number;
  faturamentoInseridos?: number;
  faturamentoApagados?: number;
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
  // `urlsManuais` é { índice da linha na planilha -> URL colada à mão }, pra linha que caiu em
  // "sem planilha correspondente" no relatório -- vence qualquer casamento automático da lista.
  importarCarteira: (
    token: string,
    cartMesId: number,
    linhas: LinhaMedicao[],
    simular: boolean,
    correcoes?: Record<number, number>,
    planilhas?: PlanilhaAnalitica[],
    urlsManuais?: Record<number, string>
  ) =>
    request<RelatorioImportacao>("/api/admin/importar-carteira", token, {
      method: "POST",
      body: JSON.stringify({ cartMesId, linhas, simular, correcoes, planilhas, urlsManuais }),
    }),
  // importação do consumo analítico -> consumo_ana + precos_cliente (duplicado) + faturamento.
  // Mesmo padrão 2x de importarCarteira. `correcoesCnpj`/`correcoesProduto` são agrupados por
  // CNPJ/ID_Produto (não por linha) -- ver RelatorioImportacaoConsumo.
  // As linhas NÃO vão mais no corpo desta chamada -- arquivos reais desse fluxo passam de 60 mil
  // linhas, e um POST só com tudo estoura o limite de tamanho de requisição da Vercel (~4.5MB)
  // antes de chegar no Express (o navegador reporta isso como erro de CORS, porque a resposta de
  // erro da própria Vercel não carrega o header de CORS -- achado 2026-08-31). As linhas sobem
  // antes, em lotes pequenos, via `limparStagingConsumo` + `enviarChunkConsumo`; esta chamada só
  // dispara a classificação/gravação em cima do que já está na tabela de preparo no banco.
  importarConsumo: (
    token: string,
    cartMesId: number,
    simular: boolean,
    correcoesCnpj?: Record<string, number>,
    correcoesProduto?: Record<string, number>
  ) =>
    request<RelatorioImportacaoConsumo>("/api/admin/importar-consumo", token, {
      method: "POST",
      body: JSON.stringify({ cartMesId, simular, correcoesCnpj, correcoesProduto }),
    }),
  // limpa qualquer resto de uma sessão de upload anterior pro mesmo mês -- chamar sempre antes
  // de começar a subir os lotes de uma nova análise (nunca deve reter dado de uma tentativa
  // anterior/abandonada).
  limparStagingConsumo: (token: string, cartMesId: number) =>
    request<{ ok: boolean }>("/api/admin/importar-consumo/limpar-staging", token, {
      method: "POST",
      body: JSON.stringify({ cartMesId }),
    }),
  // sobe um lote pequeno de linhas pra tabela de preparo -- chamado repetidamente (um POST por
  // lote) até esgotar todas as linhas lidas dos arquivos.
  enviarChunkConsumo: (token: string, cartMesId: number, linhas: LinhaConsumo[]) =>
    request<{ inseridos: number; totalNaStaging: number }>("/api/admin/importar-consumo/chunk", token, {
      method: "POST",
      body: JSON.stringify({ cartMesId, linhas }),
    }),
  // sync dos índices econômicos com o Banco Central (SGS) -- POST /api/admin/indices/sync
  sincronizarIndices: (token: string) =>
    request<{
      ok: boolean;
      fonte: string;
      atualizadoEm: string;
      indices: { nome: string; serie: number; mesesGravados: number; ultimoMes: string | null; ultimoValor: number | null }[];
    }>("/api/admin/indices/sync", token, { method: "POST" }),
  // reajuste de preço de consumo -- POST /api/admin/reajuste/simular (só lê, calcula o valor
  // novo de cada contrato com aniversário no mês corrente) e /aplicar (grava, recebe os pc_id
  // marcados na tela). Mesmo padrão 2x de importarConsumo/importarCarteira.
  simularReajuste: (token: string) =>
    request<{ ok: boolean; anoRef: number; mesRef: number; candidatos: CandidatoReajuste[] }>(
      "/api/admin/reajuste/simular",
      token,
      { method: "POST" }
    ),
  aplicarReajuste: (token: string, pcIds: number[]) =>
    request<{
      ok: boolean;
      anoRef: number;
      mesRef: number;
      aplicados: number;
      eventos: CandidatoReajuste[];
      ignorados: { pc_id: number; motivo: string }[];
    }>("/api/admin/reajuste/aplicar", token, { method: "POST", body: JSON.stringify({ pcIds }) }),
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
