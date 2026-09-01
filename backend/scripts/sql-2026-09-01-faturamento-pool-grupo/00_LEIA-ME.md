# Faturamento passa a usar o pool de franquia por grupo de produto — SQL de produção

**Contexto**: usuário reportou que o "Total de consumo" da lista de meses (Financeiro, mês
2026/08) não batia com nenhum totalizador da tela de Faturamento (líquido/bruto/a faturar).
Investigação encontrou a causa: `faturamento_detalhe.fat_vlr_liq/fat_vlr_brt` somavam o
`GREATEST(franquia, excedente)` calculado **linha a linha, por produto individual** — sem o pool
de franquia por `produto_grupo` que a tela de Consumo e `cart_mes_resumo.total_consumo` já usam
(um contrato pode cobrir vários produtos do mesmo grupo com uma franquia só). Isso já estava
sinalizado como incerteza em `views.sql` desde a criação da view original. Confirmado com o
usuário (2026-09-01): Faturamento deve usar o mesmo pool.

`01_atualizar_view.sql`: `CREATE OR REPLACE VIEW faturamento_detalhe` com o `GREATEST` agora
agrupado por `(cliente, produto_grupo)` antes de somar, com o fator fiscal BRUTO/LIQUIDO aplicado
por cima do total já agrupado (não mais linha a linha). Idempotente, só troca a definição da
view.

**Efeito esperado**: os totalizadores de Faturamento devem passar a bater com o "Total de
consumo" da lista de meses (ajustado só pelo fator fiscal 0,9165/0,91651 conforme o regime do
cliente) -- rode a consulta de conferência no final do script e compare com o "Total de consumo"
mostrado em Financeiro pro mesmo mês.

**Também corrigido no frontend** (mesmo commit): o relatório PDF de Faturamento
(`FaturamentoMesPage.tsx`, botão "Relatório") somava o valor por linha/produto pra montar o total
do relatório -- trocado pra usar o mesmo total já agrupado que o StatCard e o CSV Protheus usam,
senão o PDF mostraria um número diferente do resto da tela mesmo depois desta correção.
