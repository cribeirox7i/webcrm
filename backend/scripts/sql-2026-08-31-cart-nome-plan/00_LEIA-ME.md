# Corrigir cart_nome_plan_analitica — SQL de produção (Supabase SQL Editor)

**Achado (2026-08-31)**: a coluna gerada `carteira.cart_nome_plan_analitica` usa `cart_prod` como
base do nome do arquivo — mas o nome real dos arquivos de medição no Google Drive usa `cart_db`
(o "slug", ex. `2mj_factor`, `crefazscm_webscm`), não `cart_prod` (texto descritivo, ex. "Módulo
WebFactor"). Confirmado cruzando a fórmula original do AppSheet (que referencia a coluna do
database) com nomes reais de arquivo (`2mj_factor_Medicao_2026-07-01_2026-07-05.xlsx`, nunca
`Módulo WebFactor_Medicao_...`). O engano já vinha do schema original (SQLite), não é desta leva.

**Impacto de não corrigir**: nenhum — essa coluna não é lida por nenhuma tela hoje (só
`cart_url_plan_analitica`, coluna separada, é). Só corrige por consistência, e porque a nova
importação de carteira (leva "Link da planilha analítica") usa a mesma fórmula em JS
(`nomePlanAnalitica`, já corrigida no código) pra casar cada linha com a lista de planilhas do
Drive — se um dia algo passar a ler a coluna do banco direto, ela já estará certa.

Rodar **nesta ordem**. Ambos idempotentes (podem rodar de novo sem estragar nada).

| # | arquivo | o que faz |
|---|---|---|
| 1 | `01_diagnostico.sql` | só `SELECT` — mostra o nome atual (errado) lado a lado com o nome que a fórmula corrigida geraria. Confira antes de aplicar. |
| 2 | `02_corrigir_formula.sql` | `DROP`+`ADD COLUMN` da coluna gerada com `cart_db` no lugar de `cart_prod` (Postgres não permite `ALTER` na expressão de uma `GENERATED` column). Reescreve a tabela inteira pra recalcular (~5-6 mil linhas, sem problema de volume). Termina com um `SELECT` de conferência. |

Não mexe em `cart_url_plan_analitica` (as URLs de jan-jun/2026, preenchidas manualmente na
migração inicial, continuam como estão).
