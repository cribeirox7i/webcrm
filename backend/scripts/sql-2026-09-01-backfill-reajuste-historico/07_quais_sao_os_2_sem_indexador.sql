-- Identifica os 2 (de 70) contratos com pc_dat_ult_reajuste preenchido mas SEM pc_cod_index --
-- esses ficam de fora do backfill de reajuste_eventos (sem indexador não dá pra calcular taxa).
SELECT pc.pc_id, c.cliente_nome, p.produto_nome, p.produto_detalhe,
       pc.pc_dat_ult_reajuste, pc.pc_vlr_unit, pc.pc_vlr_franquia
FROM precos_cliente pc
JOIN clientes c ON c.cliente_id = pc.cliente_id
JOIN produtos p ON p.produto_id = pc.produto_id
WHERE pc.pc_dat_ult_reajuste IS NOT NULL
  AND pc.pc_cod_index IS NULL;
