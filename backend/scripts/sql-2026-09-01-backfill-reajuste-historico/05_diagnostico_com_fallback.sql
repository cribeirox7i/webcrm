-- v4: quando o índice do mês exato de pc_dat_ult_reajuste ainda não foi publicado (índice do
-- mês corrente, comum pro mês que acabou de fechar -- BCB publica ~dia 10 do mês seguinte), usa
-- o acumulado 12m do mês anterior (mês - 1) como aproximação. Regra do usuário (2026-09-01).
-- Só SELECT, não grava nada.

WITH base AS (
    SELECT
        pc.pc_id, pc.cliente_id, c.cliente_nome, pc.produto_id, p.produto_nome, p.produto_detalhe,
        pc.pc_dat_ult_reajuste, pc.pc_cod_index, pc.pc_vlr_unit, pc.pc_vlr_franquia,
        EXTRACT(YEAR FROM pc.pc_dat_ult_reajuste::date)::int AS ano_ref,
        EXTRACT(MONTH FROM pc.pc_dat_ult_reajuste::date)::int AS mes_ref
    FROM precos_cliente pc
    JOIN clientes c ON c.cliente_id = pc.cliente_id
    JOIN produtos p ON p.produto_id = pc.produto_id
    WHERE pc.pc_dat_ult_reajuste IS NOT NULL
),
com_mes_anterior AS (
    SELECT
        b.*,
        CASE WHEN b.mes_ref = 1 THEN b.ano_ref - 1 ELSE b.ano_ref END AS ano_ant,
        CASE WHEN b.mes_ref = 1 THEN 12 ELSE b.mes_ref - 1 END AS mes_ant
    FROM base b
)
SELECT
    b.pc_id, b.cliente_nome, b.produto_nome, b.produto_detalhe,
    b.pc_dat_ult_reajuste, b.pc_cod_index,
    b.ano_ref, b.mes_ref, ic_exato.index_acum_12m AS acum_mes_exato,
    b.ano_ant, b.mes_ant, ic_ant.index_acum_12m AS acum_mes_anterior,
    COALESCE(ic_exato.index_acum_12m, ic_ant.index_acum_12m) AS taxa_final,
    CASE
        WHEN ic_exato.index_acum_12m IS NOT NULL THEN 'mes_exato'
        WHEN ic_ant.index_acum_12m IS NOT NULL THEN 'mes_anterior'
        ELSE 'sem_indice'
    END AS origem_taxa
FROM com_mes_anterior b
LEFT JOIN indices_calculados ic_exato
    ON ic_exato.index_nome = b.pc_cod_index AND ic_exato.index_ano = b.ano_ref AND ic_exato.index_mes = b.mes_ref
LEFT JOIN indices_calculados ic_ant
    ON ic_ant.index_nome = b.pc_cod_index AND ic_ant.index_ano = b.ano_ant AND ic_ant.index_mes = b.mes_ant
ORDER BY b.cliente_nome, b.produto_nome;

-- resumo (rodar separado)
WITH base AS (
    SELECT
        pc.pc_id, pc.pc_cod_index,
        EXTRACT(YEAR FROM pc.pc_dat_ult_reajuste::date)::int AS ano_ref,
        EXTRACT(MONTH FROM pc.pc_dat_ult_reajuste::date)::int AS mes_ref
    FROM precos_cliente pc
    WHERE pc.pc_dat_ult_reajuste IS NOT NULL
),
com_mes_anterior AS (
    SELECT b.*,
        CASE WHEN b.mes_ref = 1 THEN b.ano_ref - 1 ELSE b.ano_ref END AS ano_ant,
        CASE WHEN b.mes_ref = 1 THEN 12 ELSE b.mes_ref - 1 END AS mes_ant
    FROM base b
)
SELECT
    count(*) AS total_70,
    count(*) FILTER (WHERE ic_exato.index_acum_12m IS NOT NULL) AS usa_mes_exato,
    count(*) FILTER (WHERE ic_exato.index_acum_12m IS NULL AND ic_ant.index_acum_12m IS NOT NULL) AS usa_mes_anterior,
    count(*) FILTER (WHERE ic_exato.index_acum_12m IS NULL AND ic_ant.index_acum_12m IS NULL) AS continua_sem_indice
FROM com_mes_anterior b
LEFT JOIN indices_calculados ic_exato
    ON ic_exato.index_nome = b.pc_cod_index AND ic_exato.index_ano = b.ano_ref AND ic_exato.index_mes = b.mes_ref
LEFT JOIN indices_calculados ic_ant
    ON ic_ant.index_nome = b.pc_cod_index AND ic_ant.index_ano = b.ano_ant AND ic_ant.index_mes = b.mes_ant;
