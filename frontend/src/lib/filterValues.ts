/** Helpers pro estado de filtro do `DataGrid` (`Record<string, string>`) quando controlado de
 * fora -- usado pelos cards de `StatCards` clicáveis (ver DataGrid.tsx, `filterValues`/
 * `onFilterValuesChange`). Compartilhado pra não duplicar a mesma lógica de alternar/limpar em
 * cada tela que ganhar essa interatividade. */

/** Alterna um filtro: se `key` já vale `value` (o card já está ativo), remove a chave -- volta
 * pro estado "sem filtro" nesse campo, equivalente a clicar de novo pra desligar. Senão, define
 * `value`. Outras chaves do objeto (filtro de outro dropdown da mesma tela, ex. um campo sem
 * card correspondente) não são tocadas. */
export function toggleFilterValue(
  prev: Record<string, string>,
  key: string,
  value: string
): Record<string, string> {
  if (prev[key] === value) {
    const next = { ...prev };
    delete next[key];
    return next;
  }
  return { ...prev, [key]: value };
}

/** Remove um conjunto de chaves do filtro -- usado pelo card "Total"/"Todos" pra limpar só os
 * campos que os OUTROS cards da mesma lista controlam, sem mexer em filtro de dropdown de campo
 * sem card (ex.: "Família" em Servidores, que não tem card, mas convive com "Status"/"Ambiente"
 * que têm). */
export function clearFilterKeys(prev: Record<string, string>, keys: string[]): Record<string, string> {
  const next = { ...prev };
  keys.forEach((k) => delete next[k]);
  return next;
}
