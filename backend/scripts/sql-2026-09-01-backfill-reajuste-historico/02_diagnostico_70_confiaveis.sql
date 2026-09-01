-- Diagnóstico v2: agora que pc_dat_ult_reajuste só tem os 70 contratos confiáveis (ver
-- sql-2026-09-01-backfill-aniversario/04_limpar_ultimo_reajuste.sql), retoma o backfill de
-- reajuste_eventos com esse escopo -- sem misturar com o dado descartado da carga de agosto.
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
)
SELECT
    pc_id, cliente_nome, produto_nome, produto_detalhe,
    ano_mes_ant AS mes_anterior, cart_ano_mes AS mes_atual,
    pc_dat_ult_reajuste, pc_cod_index,
    vlr_unit_ant, pc_vlr_unit,
    CASE WHEN vlr_unit_ant IS NOT NULL AND vlr_unit_ant <> 0
         THEN ROUND((((pc_vlr_unit / vlr_unit_ant) - 1) * 100)::numeric, 4) END AS variacao_unit_pct,
    vlr_franquia_ant, pc_vlr_franquia,
    CASE WHEN vlr_franquia_ant IS NOT NULL AND vlr_franquia_ant <> 0
         THEN ROUND((((pc_vlr_franquia / vlr_franquia_ant) - 1) * 100)::numeric, 4) END AS variacao_franquia_pct,
    (ano_mes_ant IS NULL) AS sem_mes_anterior,
    EXISTS (SELECT 1 FROM reajuste_eventos re WHERE re.pc_id = linhagem.pc_id) AS ja_tem_evento
FROM linhagem
WHERE pc_dat_ult_reajuste IS NOT NULL
ORDER BY cliente_nome, produto_nome;
-- esperado: 70 linhas (o total de contratos com pc_dat_ult_reajuste hoje)

-- resumo agregado -- roda separado (é a 2ª consulta do arquivo, mesma pegadinha de sempre do
-- Supabase SQL Editor: só mostra a última se rodar o arquivo inteiro de uma vez)
WITH linhagem AS (
    SELECT
        pc.pc_id, pc.cliente_id, pc.produto_id, pc.pc_dat_ult_reajuste,
        pc.pc_vlr_unit, pc.pc_vlr_franquia,
        cm.cart_ano_mes,
        LAG(cm.cart_ano_mes) OVER (PARTITION BY pc.cliente_id, pc.produto_id ORDER BY cm.cart_ano_mes) AS ano_mes_ant,
        LAG(pc.pc_vlr_unit) OVER (PARTITION BY pc.cliente_id, pc.produto_id ORDER BY cm.cart_ano_mes) AS vlr_unit_ant,
        LAG(pc.pc_vlr_franquia) OVER (PARTITION BY pc.cliente_id, pc.produto_id ORDER BY cm.cart_ano_mes) AS vlr_franquia_ant
    FROM precos_cliente pc
    LEFT JOIN cart_mes cm ON cm.cart_mes_id = pc.cart_mes_id
    WHERE pc.pc_dat_ult_reajuste IS NOT NULL
)
SELECT
    count(*) AS total_70,
    count(*) FILTER (WHERE ano_mes_ant IS NULL) AS sem_mes_anterior,
    count(*) FILTER (WHERE vlr_unit_ant IS NOT NULL AND vlr_unit_ant <> 0 AND pc_vlr_unit IS DISTINCT FROM vlr_unit_ant) AS unit_variou,
    count(*) FILTER (WHERE vlr_franquia_ant IS NOT NULL AND vlr_franquia_ant <> 0 AND pc_vlr_franquia IS DISTINCT FROM vlr_franquia_ant) AS franquia_variou,
    count(*) FILTER (
        WHERE vlr_unit_ant IS NOT NULL AND vlr_unit_ant <> 0 AND vlr_franquia_ant IS NOT NULL AND vlr_franquia_ant <> 0
          AND pc_vlr_unit IS DISTINCT FROM vlr_unit_ant AND pc_vlr_franquia IS DISTINCT FROM vlr_franquia_ant
          AND ABS(ROUND((((pc_vlr_unit / vlr_unit_ant) - 1) * 100)::numeric, 2)
                - ROUND((((pc_vlr_franquia / vlr_franquia_ant) - 1) * 100)::numeric, 2)) > 0.5
    ) AS taxas_divergem_mais_de_0_5pct,
    count(*) FILTER (
        WHERE (vlr_unit_ant IS NULL OR vlr_unit_ant = 0 OR pc_vlr_unit IS NOT DISTINCT FROM vlr_unit_ant)
          AND (vlr_franquia_ant IS NULL OR vlr_franquia_ant = 0 OR pc_vlr_franquia IS NOT DISTINCT FROM vlr_franquia_ant)
          AND ano_mes_ant IS NOT NULL
    ) AS sem_nenhuma_variacao
FROM linhagem;
