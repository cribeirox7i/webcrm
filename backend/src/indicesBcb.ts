// Busca os índices econômicos na API pública do Banco Central (SGS -- Sistema Gerenciador de
// Séries Temporais). Sem chave, sem cadastro, sem custo -- só um GET por série.
// Doc: https://dadosabertos.bcb.gov.br/dataset/... / endpoint bcdata.sgs.{serie}
//
// Este módulo só BUSCA e normaliza -- quem grava em indices_economicos é routes/adminIndices.ts.

export interface SerieIndice {
  /** index_nome já no formato padronizado usado pelo resto do sistema. */
  nome: string;
  /** número da série SGS -- vai pra coluna index_cod. */
  serie: number;
  meses: { ano: number; mes: number; vlr: number }[];
}

// index_nome -> série SGS.
// IPCA/INPC/IGP-M/CDI: variação percentual do mês (a view indices_calculados faz /100).
// SALÁRIO MÍNIMO: valor em R$ (a view calcula a variação pela razão com o mês anterior).
const SERIES: { nome: string; serie: number }[] = [
  { nome: "IPCA", serie: 433 },
  { nome: "INPC", serie: 188 },
  { nome: "IGP-M", serie: 189 },
  { nome: "CDI", serie: 4391 }, // CDI acumulado no mês, % a.m.
  { nome: "SALÁRIO MÍNIMO", serie: 1619 },
];

// histórico puxado a cada sync -- upsert (ON CONFLICT) torna re-execução barata, então não há
// problema em sempre trazer alguns anos.
const DATA_INICIAL = "01/01/2022";

interface LinhaSgs {
  data: string; // "DD/MM/YYYY"
  valor: string; // número com ponto decimal, ex. "0.42"
}

function parseLinha(linha: LinhaSgs): { ano: number; mes: number; vlr: number } | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(linha.data ?? "");
  if (!m) return null;
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const vlr = Number(linha.valor);
  if (!Number.isFinite(vlr) || mes < 1 || mes > 12 || ano < 1994) return null;
  return { ano, mes, vlr };
}

async function buscarSerie(nome: string, serie: number): Promise<SerieIndice> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?formato=json&dataInicial=${DATA_INICIAL}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!resp.ok) {
    throw new Error(`Banco Central respondeu ${resp.status} para a série ${serie} (${nome})`);
  }
  const linhas = (await resp.json()) as LinhaSgs[];
  if (!Array.isArray(linhas)) {
    throw new Error(`resposta inesperada do Banco Central para a série ${serie} (${nome})`);
  }
  const meses = linhas
    .map(parseLinha)
    .filter((x): x is { ano: number; mes: number; vlr: number } => x !== null);
  return { nome, serie, meses };
}

/** Busca todas as séries em paralelo. Se alguma falhar, a Promise rejeita -- o sync é
 * "tudo ou nada" pra não deixar um subconjunto atualizado sem o admin perceber. */
export async function buscarIndicesBcb(): Promise<SerieIndice[]> {
  return Promise.all(SERIES.map((s) => buscarSerie(s.nome, s.serie)));
}
