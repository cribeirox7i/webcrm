-- ============================================================
-- 02 - Recriar a view indices_calculados (rodar DEPOIS do 01)
-- Unica mudanca: o ramo especial de "valor em R$" agora casa 'SALÁRIO MÍNIMO'
-- (era 'SALÁRIO'). CDI/INPC/IGP-M/IPCA caem no ELSE (index_vlr / 100).
-- ============================================================

-- Se o CREATE OR REPLACE reclamar de mudanca de colunas, rode antes:
--   DROP VIEW IF EXISTS indices_calculados;
CREATE OR REPLACE VIEW indices_calculados AS
WITH var_mes AS (
    SELECT
        ie.*,
        CASE
            WHEN ie.index_nome = 'SALÁRIO MÍNIMO' THEN
                (ie.index_vlr / NULLIF(COALESCE(LAG(ie.index_vlr) OVER (
                    PARTITION BY ie.index_nome ORDER BY ie.index_ano, ie.index_mes
                ), ie.index_vlr), 0)) - 1
            ELSE ie.index_vlr / 100.0
        END AS index_var_mes
    FROM indices_economicos ie
)
SELECT
    vm.*,
    SUM(vm.index_var_mes) OVER (
        PARTITION BY vm.index_nome ORDER BY vm.index_ano, vm.index_mes
        ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
    ) AS index_acum_12m
FROM var_mes vm;

-- confere
SELECT index_nome, count(*) linhas, max((index_ano::text || '-' || lpad(index_mes::text,2,'0'))) ultimo_mes
FROM indices_calculados GROUP BY index_nome ORDER BY index_nome;
