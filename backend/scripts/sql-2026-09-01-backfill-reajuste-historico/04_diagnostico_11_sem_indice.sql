-- Detalha os 11 (de 70) que ainda ficam sem index_acum_12m mesmo depois do resync -- pra
-- entender se é nome de indexador que não bate com os 5 sincronizados (IPCA/INPC/IGP-M/CDI/
-- SALÁRIO MÍNIMO) ou só mês sem dado publicado. Só SELECT.

SELECT
    pc.pc_id, c.cliente_nome, p.produto_nome,
    pc.pc_cod_index,
    EXTRACT(YEAR FROM pc.pc_dat_ult_reajuste::date)::int AS ano_ref,
    EXTRACT(MONTH FROM pc.pc_dat_ult_reajuste::date)::int AS mes_ref,
    EXISTS (
      SELECT 1 FROM indices_economicos ie WHERE ie.index_nome = pc.pc_cod_index
    ) AS indexador_existe_em_algum_mes,
    (SELECT count(*) FROM indices_economicos ie WHERE ie.index_nome = pc.pc_cod_index) AS qtd_meses_cadastrados_desse_indexador
FROM precos_cliente pc
JOIN clientes c ON c.cliente_id = pc.cliente_id
JOIN produtos p ON p.produto_id = pc.produto_id
LEFT JOIN indices_calculados ic
    ON ic.index_nome = pc.pc_cod_index
   AND ic.index_ano = EXTRACT(YEAR FROM pc.pc_dat_ult_reajuste::date)::int
   AND ic.index_mes = EXTRACT(MONTH FROM pc.pc_dat_ult_reajuste::date)::int
WHERE pc.pc_dat_ult_reajuste IS NOT NULL
  AND pc.pc_cod_index IS NOT NULL
  AND ic.index_acum_12m IS NULL
ORDER BY pc.pc_cod_index, ano_ref, mes_ref;
