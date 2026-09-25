/** Formata uma data ISO (`aaaa-mm-dd`, opcionalmente com hora embutida tipo
 * `aaaa-mm-dd hh:mm:ss`) pro padrão brasileiro `dd/mm/aaaa`. `slice(0, 10)` corta a hora antes
 * do split -- sem isso o split quebra errado quando o campo vem com hora (bug real já visto em
 * `consumo_data`, ver FaturamentoMesPage). Trabalha em string pura, sem passar por `Date`, pra
 * não sofrer deslocamento de fuso horário numa data sem hora. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
