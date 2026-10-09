-- Insere registros âncora de faturamento para clientes com precos_cliente mas sem faturamento.
-- Idempotente: ON CONFLICT DO NOTHING garante que re-executar não duplica.
-- Troque 'AAAA/MM' pela competência afetada (ex.: '2026/09').
-- Rode o 01_diagnostico.sql antes pra confirmar quais clientes serão inseridos.

INSERT INTO faturamento (cliente_id, cart_mes_id)
SELECT DISTINCT pc.cliente_id, pc.cart_mes_id
FROM precos_cliente pc
JOIN cart_mes cm ON cm.cart_mes_id = pc.cart_mes_id
WHERE cm.cart_ano_mes = 'AAAA/MM'
  AND NOT EXISTS (
      SELECT 1 FROM faturamento f
      WHERE f.cliente_id = pc.cliente_id AND f.cart_mes_id = pc.cart_mes_id
  )
ON CONFLICT DO NOTHING;

-- Confirmação: quantos foram inseridos (deve bater com a contagem do diagnóstico)
SELECT COUNT(*) AS inseridos
FROM faturamento f
JOIN cart_mes cm ON cm.cart_mes_id = f.cart_mes_id
WHERE cm.cart_ano_mes = 'AAAA/MM';
