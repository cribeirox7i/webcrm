CREATE OR REPLACE VIEW faturamento_detalhe AS
SELECT
    f.*,
    c.cliente_cnpj,
    c.cliente_cnpj_fat,
    (pool.vlr_consumo_pool * CASE WHEN c.cliente_tip_vlr = 'BRUTO' THEN 0.9165 ELSE 1 END) AS fat_vlr_liq,
    (CASE WHEN pool.vlr_consumo_pool > 0
        THEN pool.vlr_consumo_pool / (CASE WHEN c.cliente_tip_vlr = 'BRUTO' THEN 1 ELSE 0.91651 END)
        ELSE 0
    END) AS fat_vlr_brt
FROM faturamento f
JOIN clientes c ON c.cliente_id = f.cliente_id
JOIN LATERAL (
    SELECT COALESCE(SUM(GREATEST(soma_franquia, soma_exced)), 0) AS vlr_consumo_pool
    FROM (
        SELECT
            p2.produto_grupo,
            SUM(pc2.pc_vlr_franquia) AS soma_franquia,
            SUM(COALESCE((SELECT SUM(consumo_qtd) FROM consumo_ana ca2
                 WHERE ca2.cliente_id = pc2.cliente_id AND ca2.produto_id = pc2.produto_id
                   AND ca2.cart_mes_id = pc2.cart_mes_id), 0) * pc2.pc_vlr_unit) AS soma_exced
        FROM precos_cliente pc2
        JOIN produtos p2 ON p2.produto_id = pc2.produto_id
        WHERE pc2.cliente_id = f.cliente_id AND pc2.cart_mes_id = f.cart_mes_id
        GROUP BY p2.produto_grupo
    ) sub2
) pool ON true;

-- conferência: soma dos totalizadores de Faturamento (SEM o fator fiscal aplicado, pra comparar
-- direto com "Total de consumo" da lista de meses -- não vai bater 1:1 se tiver cliente BRUTO,
-- só serve pra ver se a ordem de grandeza agora faz sentido) pro mês que você quiser conferir.
-- Troque 'AAAA/MM' pela competência de verdade.
SELECT
    cm.cart_ano_mes,
    (SELECT total_consumo FROM cart_mes_resumo cmr WHERE cmr.cart_mes_id = cm.cart_mes_id) AS total_consumo_financeiro,
    SUM(fd.fat_vlr_liq) AS soma_fat_vlr_liq,
    SUM(fd.fat_vlr_brt) AS soma_fat_vlr_brt
FROM cart_mes cm
JOIN faturamento_detalhe fd ON fd.cart_mes_id = cm.cart_mes_id
WHERE cm.cart_ano_mes = 'AAAA/MM'
GROUP BY cm.cart_ano_mes, cm.cart_mes_id;
