# Reajuste de preço de consumo — SQL de produção (Supabase SQL Editor)

**Contexto**: nova feature Admin > Reajuste — reajusta `pc_vlr_unit`/`pc_vlr_franquia` de
`precos_cliente` uma vez por ano, no mês de aniversário do contrato (`pc_dat_niver`), usando o
acumulado de 12 meses do indexador do contrato (`pc_cod_index`) no mês/ano corrente
(`indices_calculados.index_acum_12m`). Fórmula (decisão do usuário, 2026-09-01):
`novo_valor = valor_atual * (1 + index_acum_12m)`.

Precisa de uma tabela nova (`reajuste_eventos`, histórico de cada reajuste aplicado — valor
antes/depois, indexador e acumulado usado) e uma view (`reajuste_eventos_detalhe`, junta nome de
cliente/produto pra exibição). Rodar **antes do próximo deploy** valer pra alguma coisa — sem
isso o backend responde erro ao tentar simular/aplicar/listar histórico.

| # | arquivo | o que faz |
|---|---|---|
| 1 | `01_criar_tabela_e_view.sql` | `CREATE TABLE IF NOT EXISTS` + `CREATE OR REPLACE VIEW` + índices — idempotente, pode rodar de novo sem estragar nada. |

## Depois do SQL

Nenhum passo adicional — o reajuste em si roda pela tela Admin > Reajuste (simular, conferir,
aplicar), sem backfill nenhum: a tabela nasce vazia, cada aplicação futura grava sua própria
linha de histórico.
