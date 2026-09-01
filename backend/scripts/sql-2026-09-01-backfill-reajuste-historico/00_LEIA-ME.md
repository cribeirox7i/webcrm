# Backfill de reajuste_eventos histórico — SQL de produção (Supabase SQL Editor)

**Contexto**: `reajuste_eventos` (criada na leva "Reajuste de preço de consumo") só passou a ser
alimentada por reajustes aplicados via Admin > Reajuste dali pra frente. Existem contratos em
`precos_cliente` com `pc_dat_ult_reajuste` já preenchido (reajuste feito antes dessa tela existir)
sem evento nenhum no histórico. Pedido do usuário (2026-09-01): preencher `reajuste_eventos`
retroativamente pra esses casos.

**Histórico da decisão** (mudou de rumo mais de uma vez, registrado pra não repetir a mesma
investigação):

1. **Plano original**: comparar cada linha com o mês anterior (mesmo cliente+produto) e calcular
   a "taxa observada" = `(valor_novo / valor_anterior) - 1`. **Descartado**: `01_diagnostico.sql`
   mostrou que os 70 contratos confiáveis (ver
   `sql-2026-09-01-backfill-aniversario/`) **não têm mês anterior nenhum** pra comparar — não
   existe "antes" registrado no banco pra nenhum deles. Taxa observada é inviável.
2. **Plano final** (`02_diagnostico_70_confiaveis.sql` em diante): a taxa vem do **acumulado 12m
   do indexador do próprio contrato** (`pc_cod_index`) na view `indices_calculados`, no mês/ano de
   `pc_dat_ult_reajuste` — e se esse mês específico ainda não tiver o índice publicado (comum no
   mês que acabou de fechar; BCB publica IPCA/INPC por volta do dia 10 do mês seguinte), usa o
   **mês anterior** como aproximação (regra do usuário, 2026-09-01). O valor "antes" é calculado
   de trás pra frente a partir do valor atual ("depois"): `antes = depois / (1 + taxa)` — mesma
   fórmula da tela Admin > Reajuste, só invertida.
3. Only 2 dos 70 ficaram de fora por falta de indexador cadastrado (`pc_cod_index` nulo) — os 2
   contratos da **CRESCER SECURITIZADORA S.A.** (`pc_id` 23828 e 25108). Usuário confirmou que o
   indexador certo é IPCA; corrigido em
   `sql-2026-09-01-backfill-aniversario/06_ajustar_indice_crescer.sql` antes do backfill final.

| # | arquivo | o que faz |
|---|---|---|
| 1 | `01_diagnostico.sql` | descartado (ver item 1 acima) — mantido só como registro da investigação. |
| 2 | `02_diagnostico_70_confiaveis.sql` | confirma que todos os 70 não têm mês anterior. |
| 3 | `03_diagnostico_via_indice.sql` | testa a ideia do acumulado 12m do indexador no mês exato — 43/70 tinham dado (depois de resincronizar os índices, 57/70). |
| 4 | `04_diagnostico_11_sem_indice.sql` | detalha os 11 que sobraram sem índice do mês exato mesmo depois do resync — todos de agosto/2026 (mês recém-fechado, índice ainda não publicado). |
| 5 | `05_diagnostico_com_fallback.sql` | com a regra do mês anterior como fallback, 68/70 resolvidos (57 mês exato + 11 fallback), só 2 sem indexador. |
| 6 | `06_backfill_reajuste_eventos.sql` | **o INSERT de verdade** — grava evento pros 70 (mês exato/fallback conforme disponibilidade), com o valor "antes" calculado a partir do "depois". Idempotente (`NOT EXISTS` por `pc_id`). |
| 7 | `07_quais_sao_os_2_sem_indexador.sql` | identifica os 2 sem `pc_cod_index` (CRESCER SECURITIZADORA). |
| 8 | `08_conferencia_final.sql` | `count(*)` em `reajuste_eventos` — esperado 70. |

**Testado antes de entregar**: `06_backfill_reajuste_eventos.sql` verificado via PGlite com 3
contratos sintéticos (mês exato disponível, fallback pro mês anterior, sem indexador) + reexecução
pra confirmar idempotência — todos os casos bateram, incluindo o valor "antes" calculado
corretamente a partir do "depois" e da taxa.

**Rodado e conferido em produção (2026-09-01)**: `08_conferencia_final.sql` confirmou **70**
eventos criados — cobertura completa dos contratos confiáveis, sem nenhuma exceção.
