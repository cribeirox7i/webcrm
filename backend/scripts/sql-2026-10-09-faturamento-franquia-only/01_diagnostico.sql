-- Diagnóstico: clientes com precos_cliente no mês mas sem registro em faturamento.
-- São os clientes "só franquia" que estão sumindo da tela de Faturamento.
-- Troque 'AAAA/MM' pela competência afetada (ex.: '2026/09').

SELECT
    cm.cart_ano_mes,
    pc.cliente_id,
    c.cliente_nome,
    COUNT(pc.pc_id) AS qtd_produtos,
    SUM(pc.pc_vlr_franquia) AS total_franquia
FROM precos_cliente pc
JOIN clientes c ON c.cliente_id = pc.cliente_id
JOIN cart_mes cm ON cm.cart_mes_id = pc.cart_mes_id
WHERE cm.cart_ano_mes = '2026/09'
  AND NOT EXISTS (
      SELECT 1 FROM faturamento f
      WHERE f.cliente_id = pc.cliente_id AND f.cart_mes_id = pc.cart_mes_id
  )
GROUP BY cm.cart_ano_mes, pc.cliente_id, c.cliente_nome
ORDER BY c.cliente_nome;
