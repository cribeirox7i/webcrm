CREATE OR REPLACE VIEW reajuste_eventos_detalhe AS
SELECT
    re.*,
    c.cliente_nome,
    c.cliente_cnpj,
    p.produto_nome,
    p.produto_detalhe,
    pc.pc_dat_niver
FROM reajuste_eventos re
JOIN clientes c ON c.cliente_id = re.cliente_id
JOIN produtos p ON p.produto_id = re.produto_id
LEFT JOIN precos_cliente pc ON pc.pc_id = re.pc_id;

-- conferência
SELECT pc_dat_niver, count(*) FROM reajuste_eventos_detalhe GROUP BY pc_dat_niver ORDER BY 1 LIMIT 5;
