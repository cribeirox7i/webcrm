# Reverter reajustes negativos do backfill histórico — SQL de produção

**Contexto**: o backfill de `reajuste_eventos` (leva anterior) gravou eventos retroativos usando
o acumulado 12m real do indexador na época, incluindo casos em que o índice (IGP-M) estava
**negativo** (deflação). Depois, o usuário decidiu que reajuste com acumulado negativo não deveria
ser aplicado (regra nova em `adminReajuste.ts`, só vale pra reajustes novos via Admin > Reajuste).
Pedido (2026-09-01): esses casos retroativos negativos também não deveriam ter reduzido o preço --
reverter `precos_cliente.pc_vlr_unit`/`pc_vlr_franquia` pro valor de antes do reajuste (guardado em
`reajuste_eventos.reaj_vlr_unit_ant`/`reaj_vlr_franquia_ant`) e remover o evento do histórico.

Como cada um desses 70 contratos só tem 1 linha em `precos_cliente` (nenhum tinha mês anterior no
banco, achado da leva do backfill), corrigir a linha atual já cobre "daqui pra frente" -- não tem
linha de mês futuro pra corrigir separado.

| # | arquivo | o que faz |
|---|---|---|
| 1 | `01_diagnostico.sql` | só `SELECT` -- lista todo evento com `reaj_taxa_acum_12m < 0`: cliente, produto, valor atual (a reverter) e valor de antes (o que vai voltar a valer). |
| 2 | `02_reverter.sql` | `UPDATE precos_cliente` (volta pro valor de antes) + `DELETE` do evento em `reajuste_eventos`, os dois na mesma transação por `pc_id`. |

**Rodar o 1 primeiro e confirmar a lista antes do 2** -- é reversão de preço em produção, mexe no
valor cobrado de clientes reais.
