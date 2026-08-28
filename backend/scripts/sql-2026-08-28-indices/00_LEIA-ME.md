# Índices + pc_dat_ult_reajuste — SQL de produção (Supabase SQL Editor)

> **Correção 2026-08-28 (v2)**: a 1ª versão do `04`/`05` saiu em cp1252 (bug do gerador no
> Windows) — os acentos de "OCR SEM/COM VALIDAÇÃO" viravam bytes inválidos pro Postgres e
> derrubavam o `UPDATE` inteiro (por isso deu "No rows"). `04`/`05` regerados em UTF-8.
> **`01`, `02` e `03` estavam OK — não precisa rodar de novo. Só re-rodar `04` (confere) e `05`.**

> `04` e `05` **não são versionados** (embutem os dados da planilha — pc_id + CNPJ + produto).
> Pra regerar: `python backend/scripts/backfill-pc-ult-reajuste.py <xlsx> precheck > 04_backfill_precheck.sql`
> e `... <xlsx> update > 05_backfill_ult_reajuste.sql`.

Rodar **nesta ordem**. Todos são idempotentes (podem rodar de novo sem estragar nada).
Cada arquivo tem um bloco `SELECT` de conferência no começo — rode e confira antes de aplicar.

| # | arquivo | o que faz |
|---|---|---|
| 1 | `01_padronizar_indices.sql` | `IGMP` → `IGP-M`, `SALÁRIO` → `SALÁRIO MÍNIMO` em `indices_economicos.index_nome` **e** `precos_cliente.pc_cod_index` |
| 2 | `02_view_indices_calculados.sql` | recria a view `indices_calculados` com `'SALÁRIO MÍNIMO'` (roda depois do 1) |
| 3 | `03_add_col_precos.sql` | `ALTER TABLE precos_cliente ADD COLUMN IF NOT EXISTS pc_dat_ult_reajuste TEXT` |
| 4 | `04_backfill_precheck.sql` | **só SELECT** — quantos `pc_id` batem, e a **lista das divergências** (id existe mas CNPJ/produto/detalhe não bate). Revisar antes do 5. |
| 5 | `05_backfill_ult_reajuste.sql` | o `UPDATE` de fato — 2373 linhas da planilha `tabela_precos_2026-07.xlsx` (só as que têm "Ultimo Reajuste" preenchido). Está dentro de `BEGIN/COMMIT`; confira "N rows affected" antes de deixar commitar. |

## Depois do SQL

1. Deploy do código: `git push` no `main` → Vercel faz deploy automático do backend e do frontend.
2. No **Admin → Permissões**, liberar o menu **`indices`** pros usuários que devem ver a tela
   (menu novo não dá permissão automática pra ninguém — nem pra você).
3. **Admin → Índices → "Atualizar agora (Banco Central)"** pra puxar o histórico de
   IPCA / INPC / IGP-M / CDI / salário mínimo.

## Sobre o pré-check (arquivo 4)

- Consulta 1: quantos dos 2373 `pc_id` da planilha existem em `precos_cliente`. Esperado: 2373.
- Consulta 2: quantos casam **também** em CNPJ + produto + detalhe (é o que o UPDATE vai gravar).
- Consulta 3: as divergências — `pc_id` existe mas algum dos três (CNPJ/produto/detalhe) não bate.
  Se aparecer alguma linha aqui, me manda a lista pra decidirmos o que fazer antes de rodar o 5
  (o UPDATE simplesmente ignora essas linhas — elas ficam com `pc_dat_ult_reajuste` NULL).
