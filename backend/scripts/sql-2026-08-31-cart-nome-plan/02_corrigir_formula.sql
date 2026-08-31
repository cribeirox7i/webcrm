-- Corrige a coluna gerada `carteira.cart_nome_plan_analitica` pra usar cart_db (o "slug" do
-- database, ex. "2mj_factor") em vez de cart_prod (texto descritivo, ex. "Módulo WebFactor") --
-- ver 01_diagnostico.sql pro antes/depois. Postgres não permite ALTER na expressão de uma
-- GENERATED column; o jeito é DROP + ADD (idempotente: rodar de novo só recalcula os mesmos
-- valores). ADD COLUMN ... STORED reescreve a tabela inteira pra recalcular todo mundo -- ~5-6 mil
-- linhas hoje, sem problema de volume.
--
-- Não mexe em `cart_url_plan_analitica` (coluna separada, com as URLs preenchidas manualmente
-- pra jan-jun/2026) -- só na coluna de nome gerado, que hoje não é lida por nenhuma tela.

BEGIN;

ALTER TABLE carteira DROP COLUMN IF EXISTS cart_nome_plan_analitica;

ALTER TABLE carteira ADD COLUMN cart_nome_plan_analitica TEXT GENERATED ALWAYS AS (
    cart_db || '_Medicao_' ||
    substring(cart_data_base FROM 1 FOR 7) || '-01_' ||
    substring(cart_data_base FROM 1 FOR 7) || '-' || substring(cart_data_base FROM 9 FOR 2) || '.xlsx'
) STORED;

COMMIT;

-- conferência pós-fix (mesmas linhas do diagnóstico, "nome_atual_errado" deve ter sumido e o nome
-- deve bater com "nome_correto_previsto" que o 01 mostrou)
SELECT cart_id, cart_db, cart_data_base, cart_nome_plan_analitica
FROM carteira
WHERE cart_data_base IS NOT NULL
ORDER BY cart_id
LIMIT 30;
