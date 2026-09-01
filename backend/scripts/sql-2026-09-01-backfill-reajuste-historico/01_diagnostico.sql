-- Diagnóstico: contratos com pc_dat_ult_reajuste preenchido cujo valor mudou em relação ao mês
-- anterior (mesmo cliente+produto) -- candidatos a virar evento retroativo em reajuste_eventos.
-- Só SELECT, não grava nada.

WITH linhagem AS (
    SELECT
        pc.pc_id,
        pc.cliente_id, c.cliente_nome,
        pc.produto_id, p.produto_nome, p.produto_detalhe,
        pc.cart_mes_id, cm.cart_ano_mes,
        pc.pc_dat_ult_reajuste, pc.pc_cod_index,
        pc.pc_vlr_unit, pc.pc_vlr_franquia,
        LAG(cm.cart_ano_mes) OVER (PARTITION BY pc.cliente_id, pc.produto_id ORDER BY cm.cart_ano_mes) AS ano_mes_ant,
        LAG(pc.pc_vlr_unit) OVER (PARTITION BY pc.cliente_id, pc.produto_id ORDER BY cm.cart_ano_mes) AS vlr_unit_ant,
        LAG(pc.pc_vlr_franquia) OVER (PARTITION BY pc.cliente_id, pc.produto_id ORDER BY cm.cart_ano_mes) AS vlr_franquia_ant
    FROM precos_cliente pc
    JOIN clientes c ON c.cliente_id = pc.cliente_id
    JOIN produtos p ON p.produto_id = pc.produto_id
    LEFT JOIN cart_mes cm ON cm.cart_mes_id = pc.cart_mes_id
    WHERE pc.pc_dat_ult_reajuste IS NOT NULL
)
SELECT
    pc_id, cliente_nome, produto_nome, produto_detalhe,
    ano_mes_ant AS mes_anterior, cart_ano_mes AS mes_atual,
    pc_dat_ult_reajuste, pc_cod_index,
    vlr_unit_ant, pc_vlr_unit,
    CASE WHEN vlr_unit_ant IS NOT NULL AND vlr_unit_ant <> 0 AND pc_vlr_unit IS DISTINCT FROM vlr_unit_ant
         THEN ROUND((((pc_vlr_unit / vlr_unit_ant) - 1) * 100)::numeric, 4) END AS variacao_unit_pct,
    vlr_franquia_ant, pc_vlr_franquia,
    CASE WHEN vlr_franquia_ant IS NOT NULL AND vlr_franquia_ant <> 0 AND pc_vlr_franquia IS DISTINCT FROM vlr_franquia_ant
         THEN ROUND((((pc_vlr_franquia / vlr_franquia_ant) - 1) * 100)::numeric, 4) END AS variacao_franquia_pct,
    (ano_mes_ant IS NULL) AS sem_mes_anterior,
    EXISTS (SELECT 1 FROM reajuste_eventos re WHERE re.pc_id = linhagem.pc_id) AS ja_tem_evento
FROM linhagem
WHERE
    -- só interessa quem tem mês anterior pra comparar E teve variação em pelo menos um dos valores
    ano_mes_ant IS NOT NULL
    AND (
        (vlr_unit_ant IS NOT NULL AND pc_vlr_unit IS DISTINCT FROM vlr_unit_ant)
        OR (vlr_franquia_ant IS NOT NULL AND pc_vlr_franquia IS DISTINCT FROM vlr_franquia_ant)
    )
ORDER BY cliente_nome, produto_nome, cart_ano_mes;

-- resumo: quantas linhas no total têm pc_dat_ult_reajuste, quantas têm mês anterior pra comparar,
-- quantas realmente mudaram de valor, quantas já têm evento gravado (idempotência de reruns)
SELECT
    COUNT(*) FILTER (WHERE pc_dat_ult_reajuste IS NOT NULL) AS total_com_data_reajuste,
    COUNT(*) FILTER (WHERE pc_dat_ult_reajuste IS NOT NULL AND cart_mes_id IS NULL) AS sem_cart_mes_id,
    COUNT(*) FILTER (
        WHERE pc_dat_ult_reajuste IS NOT NULL
        AND EXISTS (SELECT 1 FROM reajuste_eventos re WHERE re.pc_id = pc.pc_id)
    ) AS ja_tem_evento
FROM precos_cliente pc;
