-- Backfill de reajuste_eventos pros 68 contratos (de 70) com pc_dat_ult_reajuste confiável e
-- indexador com histórico disponível. Regras confirmadas com o usuário (2026-09-01):
--   - candidatos: todo precos_cliente com pc_dat_ult_reajuste preenchido (hoje só os 70
--     confiáveis, ver sql-2026-09-01-backfill-aniversario/04_limpar_ultimo_reajuste.sql)
--   - taxa: acumulado 12m do indexador do contrato (pc_cod_index) no mês/ano de
--     pc_dat_ult_reajuste; se o índice desse mês ainda não foi publicado, usa o do mês anterior
--     (regra nova, 2026-09-01 -- comum no mês que acabou de fechar, BCB publica ~dia 10 do
--     mês seguinte)
--   - valor "depois" = pc_vlr_unit/pc_vlr_franquia atuais; valor "antes" calculado de trás pra
--     frente: antes = depois / (1 + taxa) -- mesma fórmula da tela Admin > Reajuste, invertida
--   - os 2 contratos sem pc_cod_index ficam de fora (sem indexador não dá pra calcular taxa
--     nenhuma) -- sem_indexador do diagnóstico
-- Idempotente: NOT EXISTS por pc_id evita duplicar se rodado de novo.

BEGIN;

WITH base AS (
    SELECT
        pc.pc_id, pc.cliente_id, pc.produto_id, pc.pc_dat_ult_reajuste, pc.pc_cod_index,
        pc.pc_vlr_unit, pc.pc_vlr_franquia,
        EXTRACT(YEAR FROM pc.pc_dat_ult_reajuste::date)::int AS ano_ref,
        EXTRACT(MONTH FROM pc.pc_dat_ult_reajuste::date)::int AS mes_ref
    FROM precos_cliente pc
    WHERE pc.pc_dat_ult_reajuste IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reajuste_eventos re WHERE re.pc_id = pc.pc_id)
),
com_mes_anterior AS (
    SELECT b.*,
        CASE WHEN b.mes_ref = 1 THEN b.ano_ref - 1 ELSE b.ano_ref END AS ano_ant,
        CASE WHEN b.mes_ref = 1 THEN 12 ELSE b.mes_ref - 1 END AS mes_ant
    FROM base b
),
resolvido AS (
    SELECT
        b.pc_id, b.cliente_id, b.produto_id, b.pc_dat_ult_reajuste, b.pc_cod_index,
        b.pc_vlr_unit, b.pc_vlr_franquia,
        COALESCE(ic_exato.index_ano, ic_ant.index_ano) AS reaj_index_ano,
        COALESCE(ic_exato.index_mes, ic_ant.index_mes) AS reaj_index_mes,
        COALESCE(ic_exato.index_acum_12m, ic_ant.index_acum_12m) AS taxa
    FROM com_mes_anterior b
    LEFT JOIN indices_calculados ic_exato
        ON ic_exato.index_nome = b.pc_cod_index AND ic_exato.index_ano = b.ano_ref AND ic_exato.index_mes = b.mes_ref
    LEFT JOIN indices_calculados ic_ant
        ON ic_ant.index_nome = b.pc_cod_index AND ic_ant.index_ano = b.ano_ant AND ic_ant.index_mes = b.mes_ant
)
INSERT INTO reajuste_eventos
    (pc_id, cliente_id, produto_id, reaj_data, reaj_index_nome, reaj_index_ano, reaj_index_mes,
     reaj_taxa_acum_12m, reaj_vlr_unit_ant, reaj_vlr_unit_novo, reaj_vlr_franquia_ant, reaj_vlr_franquia_novo)
SELECT
    r.pc_id, r.cliente_id, r.produto_id, r.pc_dat_ult_reajuste, r.pc_cod_index,
    r.reaj_index_ano, r.reaj_index_mes, r.taxa,
    ROUND((r.pc_vlr_unit / (1 + r.taxa))::numeric, 4), r.pc_vlr_unit,
    ROUND((r.pc_vlr_franquia / (1 + r.taxa))::numeric, 2), r.pc_vlr_franquia
FROM resolvido r
WHERE r.taxa IS NOT NULL AND r.taxa <> -1;

-- confira o número de linhas afetadas -- esperado 68 -- antes do COMMIT;
COMMIT;
