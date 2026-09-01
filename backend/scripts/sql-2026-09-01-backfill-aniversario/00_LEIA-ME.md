# Backfill de Aniversário do Contrato + Último Reajuste — SQL de produção

**Contexto**: a planilha `tabela_precos_2026-07 - V2.xlsx` (fonte correta, substitui a que gerou
o backfill em massa de `pc_dat_ult_reajuste` em 2026-08-28) tem 365 linhas com "Aniversário do
Contrato" preenchido, e dessas, 70 também têm "Último Reajuste". Pedido do usuário (2026-09-01):
gravar essas datas em `precos_cliente`, só nessas linhas.

**Gerador**: `backend/scripts/backfill-aniversario-2026-09.py` (lê a planilha, casa por `pc_id` +
CNPJ + produto + detalhe, mesmo padrão do backfill de agosto). Já rodado nos dois modos pra gerar
os arquivos desta pasta — não precisa rodar de novo, a menos que a planilha mude.

| # | arquivo | o que faz |
|---|---|---|
| 1 | `01_diagnostico.sql` | só `SELECT` — 4 consultas: quantos `pc_id` existem, quantos batem também em CNPJ+produto+detalhe, a lista de divergências (pc_id existe mas os outros campos não batem — essas linhas **não são tocadas** pelo update), e quantas linhas realmente mudam de valor (algumas podem já estar corretas). |
| 2 | `02_backfill.sql` | grava `pc_dat_niver` (todas as 365) e `pc_dat_ult_reajuste` (só as 70 que têm valor na planilha — as outras 295 mantêm o que já têm, via `COALESCE`). Idempotente. |

**Rodar nesta ordem**: 1 primeiro, conferir a consulta 3 (divergências) e a 4 (tamanho real do
impacto) — se a lista de divergências tiver algo inesperado, avisar antes de rodar o 2.

**Testado antes de entregar**: a lógica do `02_backfill.sql` (idempotência, `COALESCE` preservando
`pc_dat_ult_reajuste` quando a planilha não tem valor, e a linha de divergência ficando de fora)
foi verificada via PGlite com um recorte real de 3 linhas da planilha + 1 linha de CNPJ
propositalmente errado — todos os casos bateram.

**Rodado e conferido em produção (2026-09-01)**: 365/365 batendo, 0 divergências, aniversário já
estava correto pras 365 (0 mudanças), 48 de 70 linhas de Último Reajuste mudaram de valor de
verdade.

## Correção adicional: zerar o Último Reajuste que não é confiável (2026-09-01)

Depois do backfill acima, o usuário percebeu que `pc_dat_ult_reajuste` continuava com a data da
carga de agosto (planilha errada) nos ~2303 contratos que não estão entre os 70 confiáveis desta
planilha — o `02_backfill.sql` só sobrescreveu quem tinha valor novo, preservou o resto via
`COALESCE`. Decisão do usuário: **não** manter esse dado não confiável — zerar
`pc_dat_ult_reajuste` em todo mundo que não está nos 70, deixando só dado confirmado no banco.

| # | arquivo | o que faz |
|---|---|---|
| 3 | `03_diagnostico_limpeza.sql` | só `SELECT` — quantos vão ser zerados (esperado 2303) e quantos dos 70 confiáveis continuam preenchidos (esperado 70, já valia antes de rodar o 04). |
| 4 | `04_limpar_ultimo_reajuste.sql` | `UPDATE ... SET pc_dat_ult_reajuste = NULL` em todo `pc_id` fora da lista dos 70. Idempotente. |
| 5 | `05_conferencia_final.sql` | conta quantos contratos têm `pc_dat_ult_reajuste` preenchido no total -- tem que dar exatamente 70. |

**Rodado e conferido em produção (2026-09-01)**: `05_conferencia_final.sql` confirmou **70** --
só os contratos confiáveis ficaram com a data.

## Depois do SQL

Nenhum passo adicional pra esta pasta. O backfill de `reajuste_eventos` (histórico de reajuste)
segue em `sql-2026-09-01-backfill-reajuste-historico/`, agora com escopo limpo: só os mesmos 70
`pc_id` desta planilha, sem nenhuma mistura com o dado descartado da carga de agosto.
