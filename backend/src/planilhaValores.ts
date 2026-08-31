// Conversores de valores vindos de planilha (importação da carteira). Módulo puro, sem acesso a
// banco, justamente pra poder ser testado isoladamente (scripts/testa-conversores-medicao.ts).

export function texto(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function numero(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // planilha pode trazer "R$ 1.234,56" ou "1234,56" -- mesmo parser de moeda BR já usado na
  // migração da planilha de produção (backend/scripts/migrate_prod_xlsx_to_pg.py).
  const limpo = String(v)
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export function inteiro(v: unknown): number | null {
  const n = numero(v);
  return n == null ? null : Math.round(n);
}

/** Datas da planilha vêm como "dd/mm/aaaa" (às vezes com hora). O banco guarda ISO -- e a coluna
 * gerada cart_nome_plan_analitica depende disso (faz substring do texto), então converter aqui
 * não é cosmético: sem ISO o nome da planilha analítica sai errado. */
export function dataIso(v: unknown, comHora = false): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    const iso = v.toISOString();
    return comHora ? `${iso.slice(0, 10)} ${iso.slice(11, 19)}` : iso.slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, d, m, a, hh, mm, ss] = br;
    const data = `${a}-${m}-${d}`;
    return comHora && hh ? `${data} ${hh}:${mm}:${ss ?? "00"}` : data;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const [, a, m, d, hh, mm, ss] = iso;
    const data = `${a}-${m}-${d}`;
    return comHora && hh ? `${data} ${hh}:${mm}:${ss ?? "00"}` : data;
  }
  return s; // formato desconhecido: grava como veio, em vez de descartar silenciosamente
}

/** Reproduz em JS a mesma fórmula da coluna gerada `carteira.cart_nome_plan_analitica` (ver
 * schema.pg.sql), pra poder casar cada linha com o nome de arquivo do Drive ANTES de gravar --
 * a coluna gerada só existe depois do INSERT. `dataBaseIso` precisa já estar em "AAAA-MM-DD"
 * (saída de `dataIso`); qualquer divergência de formato aqui faz o nome não bater com o do banco.
 *
 * A base do nome é `cart_db` (o "slug" tipo "2mj_factor"), NÃO `cart_prod` (texto descritivo tipo
 * "Módulo WebFactor") -- achado 2026-08-31 batendo a fórmula original do AppSheet (que referencia
 * a coluna do database, não a do produto) contra nomes reais de arquivo no Drive. A coluna gerada
 * do banco tinha o mesmo engano herdado da migração original; corrigida junto (ver
 * backend/scripts/sql-2026-08-31-cart-nome-plan/). */
export function nomePlanAnalitica(db: string | null, dataBaseIso: string | null): string | null {
  if (!db || !dataBaseIso || dataBaseIso.length < 10) return null;
  const anoMes = dataBaseIso.slice(0, 7);
  const dia = dataBaseIso.slice(8, 10);
  return `${db}_Medicao_${anoMes}-01_${anoMes}-${dia}.xlsx`;
}
