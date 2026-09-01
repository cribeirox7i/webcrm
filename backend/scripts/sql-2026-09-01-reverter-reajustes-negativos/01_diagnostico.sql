-- Lista todo evento retroativo com taxa negativa (deflação) -- candidatos a reversão.
-- Só SELECT, não grava nada.

SELECT
    re.reaj_id, re.pc_id, c.cliente_nome, p.produto_nome, p.produto_detalhe,
    re.reaj_index_nome, re.reaj_taxa_acum_12m,
    re.reaj_vlr_unit_ant AS vlr_unit_volta_pra, pc.pc_vlr_unit AS vlr_unit_atual,
    re.reaj_vlr_franquia_ant AS vlr_franquia_volta_pra, pc.pc_vlr_franquia AS vlr_franquia_atual
FROM reajuste_eventos re
JOIN precos_cliente pc ON pc.pc_id = re.pc_id
JOIN clientes c ON c.cliente_id = re.cliente_id
JOIN produtos p ON p.produto_id = re.produto_id
WHERE re.reaj_taxa_acum_12m < 0
ORDER BY c.cliente_nome, p.produto_nome;

-- resumo (rodar separado -- mesma pegadinha de sempre do Supabase)
SELECT count(*) AS total_a_reverter FROM reajuste_eventos WHERE reaj_taxa_acum_12m < 0;
