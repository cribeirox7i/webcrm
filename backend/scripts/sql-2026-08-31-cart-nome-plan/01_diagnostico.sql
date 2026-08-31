-- Só SELECT, não altera nada. Confere o achado: a coluna gerada `cart_nome_plan_analitica`
-- (hoje baseada em cart_prod) NÃO bate com o nome real dos arquivos de medição no Drive --
-- o nome real usa cart_db (ex. "2mj_factor", "crefazscm_webscm"), não cart_prod (texto
-- descritivo, ex. "Módulo WebFactor"). "nome_correto_previsto" simula a fórmula corrigida
-- (usada no 02_corrigir_formula.sql) pra comparar lado a lado antes de aplicar.
SELECT
    cart_id,
    cart_db,
    cart_prod,
    cart_data_base,
    cart_nome_plan_analitica AS nome_atual_errado,
    cart_db || '_Medicao_' ||
      substring(cart_data_base FROM 1 FOR 7) || '-01_' ||
      substring(cart_data_base FROM 1 FOR 7) || '-' || substring(cart_data_base FROM 9 FOR 2) || '.xlsx'
      AS nome_correto_previsto
FROM carteira
WHERE cart_data_base IS NOT NULL
ORDER BY cart_id
LIMIT 30;
