/**
 * "Pace" do portfólio -- regra de negócio (cascata de IFs) que não existia como coluna
 * na planilha original (schema.sql documentava port_pace como pendente). Confirmada
 * cruzando os IDs reais de um print do usuário (33, 41, 42, 43, 44, 45, 46, 54, 55)
 * contra a massa de teste: bateu em todos os casos.
 *
 * - status CANCELADO   -> label "CANCELADO", verde se desvio >= 0, senão vermelho
 * - status CONCLUÍDO   -> label "HOLD", sempre verde
 * - qualquer outro status (ANDAMENTO, A FAZER, etc.) -> "EM DIA" (desvio >= 0) ou
 *   "ATRASADO" (desvio < 0)
 */
export interface Pace {
  label: string;
  color: "green" | "red";
}

export function paceDoPortfolio(status: string | null, desvio: number): Pace {
  if (status === "CANCELADO") return { label: "CANCELADO", color: desvio >= 0 ? "green" : "red" };
  if (status === "CONCLUÍDO") return { label: "HOLD", color: "green" };
  return desvio >= 0 ? { label: "EM DIA", color: "green" } : { label: "ATRASADO", color: "red" };
}

/**
 * No Cronograma Detalhado (nível de atividade), o AppSheet original só mostra uma bolinha
 * verde/vermelha ao lado do status cru (sem rótulo traduzido) -- diferente do Portfólio,
 * que tem a coluna "Pace" com rótulo. Aqui a cor é só o sinal do desvio (%atual - %esperado),
 * inclusive nas linhas agregadoras ('A'), que não têm status próprio.
 */
export function corDesvio(desvio: number): "green" | "red" {
  return desvio >= 0 ? "green" : "red";
}
