-- CREATE OR REPLACE VIEW não aceita remover/reordenar colunas do SELECT (só apêndice no fim) --
-- a lista explícita de colunas troca a posição de fat_dat_venc em relação ao f.* de antes, então
-- precisa DROP + CREATE em vez de REPLACE (nenhuma outra view depende de faturamento_detalhe,
-- conferido antes de gerar este script).
DROP VIEW IF EXISTS faturamento_detalhe;
CREATE VIEW faturamento_detalhe AS
SELECT
    f.fat_id,
    f.cart_mes_id,
    f.cliente_id,
    f.fat_cod_venc_protheus,
    f.fat_num_nfe,
    f.fat_num_rps,
    f.fat_obs,
    c.cliente_cnpj,
    c.cliente_cnpj_fat,
    (pool.vlr_consumo_pool * CASE WHEN c.cliente_tip_vlr = 'BRUTO' THEN 0.9165 ELSE 1 END) AS fat_vlr_liq,
    (CASE WHEN pool.vlr_consumo_pool > 0
        THEN pool.vlr_consumo_pool / (CASE WHEN c.cliente_tip_vlr = 'BRUTO' THEN 1 ELSE 0.91651 END)
        ELSE 0
    END) AS fat_vlr_brt,
    (CASE WHEN c.cliente_dia_venc_consumo IS NOT NULL AND cm.cart_ano_mes ~ '^\d{4}/\d{1,2}$' THEN
        make_date(
            split_part(cm.cart_ano_mes, '/', 1)::int,
            split_part(cm.cart_ano_mes, '/', 2)::int,
            LEAST(
                c.cliente_dia_venc_consumo,
                EXTRACT(DAY FROM (
                    make_date(split_part(cm.cart_ano_mes, '/', 1)::int, split_part(cm.cart_ano_mes, '/', 2)::int, 1)
                    + INTERVAL '1 month - 1 day'
                ))::int
            )
        )::text
    END) AS fat_dat_venc
FROM faturamento f
JOIN clientes c ON c.cliente_id = f.cliente_id
LEFT JOIN cart_mes cm ON cm.cart_mes_id = f.cart_mes_id
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

-- conferência: troque 'AAAA/MM' pela competência de verdade
SELECT fd.cliente_id, c.cliente_nome, c.cliente_dia_venc_consumo, cm.cart_ano_mes, fd.fat_dat_venc
FROM faturamento_detalhe fd
JOIN clientes c ON c.cliente_id = fd.cliente_id
JOIN cart_mes cm ON cm.cart_mes_id = fd.cart_mes_id
WHERE cm.cart_ano_mes = 'AAAA/MM'
ORDER BY c.cliente_nome;
