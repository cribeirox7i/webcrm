-- v3: sem "mês anterior" disponível pra nenhum dos 70, a taxa vem do acumulado 12m do
-- indexador do próprio contrato (pc_cod_index) no mês/ano de pc_dat_ult_reajuste
-- (indices_calculados.index_acum_12m). O valor "antes" é calculado de trás pra frente a partir
-- do valor atual (pc_vlr_unit/pc_vlr_franquia = "depois"): antes = depois / (1 + acumulado) --
-- mesma fórmula usada pela tela Admin > Reajuste, só invertida. Só SELECT, não grava nada.

SELECT
    pc.pc_id, c.cliente_nome, p.produto_nome, p.produto_detalhe,
    pc.pc_dat_ult_reajuste, pc.pc_cod_index,
    EXTRACT(YEAR FROM pc.pc_dat_ult_reajuste::date)::int AS ano_ref,
    EXTRACT(MONTH FROM pc.pc_dat_ult_reajuste::date)::int AS mes_ref,
    ic.index_acum_12m,
    pc.pc_vlr_unit AS vlr_unit_depois,
    CASE WHEN ic.index_acum_12m IS NOT NULL AND ic.index_acum_12m <> -1
         THEN ROUND((pc.pc_vlr_unit / (1 + ic.index_acum_12m))::numeric, 4) END AS vlr_unit_antes_calculado,
    pc.pc_vlr_franquia AS vlr_franquia_depois,
    CASE WHEN ic.index_acum_12m IS NOT NULL AND ic.index_acum_12m <> -1
         THEN ROUND((pc.pc_vlr_franquia / (1 + ic.index_acum_12m))::numeric, 2) END AS vlr_franquia_antes_calculado
FROM precos_cliente pc
JOIN clientes c ON c.cliente_id = pc.cliente_id
JOIN produtos p ON p.produto_id = pc.produto_id
LEFT JOIN indices_calculados ic
    ON ic.index_nome = pc.pc_cod_index
   AND ic.index_ano = EXTRACT(YEAR FROM pc.pc_dat_ult_reajuste::date)::int
   AND ic.index_mes = EXTRACT(MONTH FROM pc.pc_dat_ult_reajuste::date)::int
WHERE pc.pc_dat_ult_reajuste IS NOT NULL
ORDER BY c.cliente_nome, p.produto_nome;

-- resumo (rodar separado -- mesma pegadinha de sempre do Supabase)
SELECT
    count(*) AS total_70,
    count(*) FILTER (WHERE pc_cod_index IS NULL) AS sem_indexador,
    count(ic.index_acum_12m) AS com_indice_disponivel,
    count(*) FILTER (WHERE pc_cod_index IS NOT NULL AND ic.index_acum_12m IS NULL) AS indexador_sem_historico_no_mes
FROM precos_cliente pc
LEFT JOIN indices_calculados ic
    ON ic.index_nome = pc.pc_cod_index
   AND ic.index_ano = EXTRACT(YEAR FROM pc.pc_dat_ult_reajuste::date)::int
   AND ic.index_mes = EXTRACT(MONTH FROM pc.pc_dat_ult_reajuste::date)::int
WHERE pc.pc_dat_ult_reajuste IS NOT NULL;
