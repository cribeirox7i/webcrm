// Identificação do cliente a partir de uma linha da planilha de medição (importação da
// carteira). Regras decididas com o usuário, nesta ordem:
//   1. CNPJ normalizado casando com exatamente 1 cliente -> usa esse.
//   2. CNPJ casando com mais de 1 cliente (há CNPJ duplicado em `clientes`, erro de cadastro
//      real na base) -> escolhe o de nome mais parecido com o da planilha.
//   3. CNPJ sem cliente nenhum -> tenta pelo nome do database (coluna BD da planilha, que é o
//      mesmo valor de carteira.cart_db), procurando no histórico de carteira qual cliente já
//      usou aquele database.
//   4. Não achou -> fica de fora da importação e entra no relatório devolvido pra tela.

export interface ClienteCandidato {
  cliente_id: number;
  cliente_nome: string;
}

/** CNPJ agora é alfanumérico (Receita, 2026) -- normaliza tirando pontuação, sem assumir dígitos. */
export function normalizaCnpj(v: unknown): string {
  return String(v ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Tira acento/pontuação e colapsa espaços -- "CRÉDITO LTDA." e "CREDITO LTDA" viram iguais. */
function normalizaNome(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Coeficiente de Dice sobre bigramas: 1 = idêntico, 0 = nada em comum. Escolhido por ser
 * estável com abreviação/sufixo diferente ("THP CAPITAL" vs "THP CAPITAL SECURITIZADORA S.A."),
 * que é exatamente o caso dos CNPJs duplicados encontrados na base. */
export function similaridadeNome(a: string, b: string): number {
  const x = normalizaNome(a);
  const y = normalizaNome(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bigramas = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
  };
  const bx = bigramas(x);
  const by = bigramas(y);
  let comuns = 0;
  let totalX = 0;
  let totalY = 0;
  bx.forEach((n) => (totalX += n));
  by.forEach((n) => (totalY += n));
  bx.forEach((n, g) => {
    const m = by.get(g);
    if (m) comuns += Math.min(n, m);
  });
  return totalX + totalY === 0 ? 0 : (2 * comuns) / (totalX + totalY);
}

/** Dos candidatos com o mesmo CNPJ, devolve o de nome mais parecido com o da planilha. */
export function escolhePorNome<T extends ClienteCandidato>(nomePlanilha: string, candidatos: T[]): T | null {
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];
  let melhor = candidatos[0];
  let melhorScore = -1;
  for (const c of candidatos) {
    const score = similaridadeNome(nomePlanilha, c.cliente_nome);
    if (score > melhorScore) {
      melhorScore = score;
      melhor = c;
    }
  }
  return melhor;
}
