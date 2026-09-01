# Vencimento NFE (fat_dat_venc) passa a ser calculado — SQL de produção

**Contexto**: o usuário corrigiu meu entendimento anterior -- `fat_dat_venc` ("Vencimento NFE")
não é campo de preenchimento manual (nunca teve campo nenhum no formulário de edição de
Faturamento, só Número NFE/RPS/Observações). É **calculado automaticamente**:
`clientes.cliente_dia_venc_consumo` (o dia do mês, cadastro do cliente) + o mês/ano do `cart_mes`
da própria linha de faturamento. Decisões confirmadas com o usuário (2026-09-01):

- Sempre calculado ao vivo na view `faturamento_detalhe` (nunca gravado na coluna física
  `faturamento.fat_dat_venc`, nunca editável) -- elimina qualquer chance de divergência.
- Cliente sem `cliente_dia_venc_consumo` cadastrado: `fat_dat_venc` vem `NULL` (sinaliza cadastro
  incompleto, não inventa valor).
- Dia cadastrado maior que o último dia do mês da competência (ex. dia 31 num fevereiro): usa o
  último dia disponível daquele mês (`28` ou `29/02`, `30` em meses de 30 dias).

`01_atualizar_view.sql`: `CREATE OR REPLACE VIEW faturamento_detalhe` -- `f.*` virou lista
explícita de colunas (a coluna física `fat_dat_venc` não é mais lida, só as outras) + o cálculo
novo. Idempotente, só troca a definição da view.

**Testado antes de entregar**: PGlite com 3 clientes (dia 10 num mês de 31 dias, dia 31 num
fevereiro de 28 dias -- confirma o clamp, e sem dia cadastrado -- confirma o `NULL`) -- os 3
casos bateram.
