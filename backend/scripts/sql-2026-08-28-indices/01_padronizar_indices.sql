-- ============================================================
-- 01 - Padronizar nomes de indice (rodar no Supabase SQL Editor)
--   'IGMP'    -> 'IGP-M'
--   'SALÁRIO' -> 'SALÁRIO MÍNIMO'
-- Afeta indices_economicos.index_nome e precos_cliente.pc_cod_index.
-- ============================================================

-- ---- diagnostico (rode primeiro, confira) ----
SELECT 'indices_economicos.index_nome' AS onde, index_nome, count(*) AS linhas
FROM indices_economicos GROUP BY index_nome ORDER BY index_nome;

SELECT 'precos_cliente.pc_cod_index' AS onde, pc_cod_index, count(*) AS linhas
FROM precos_cliente GROUP BY pc_cod_index ORDER BY pc_cod_index;

-- colisao: ja existe linha 'IGP-M' e 'IGMP' pro mesmo ano/mes? (idem SALÁRIO)
SELECT a.index_nome AS de, b.index_nome AS para, a.index_ano, a.index_mes
FROM indices_economicos a
JOIN indices_economicos b
  ON b.index_ano = a.index_ano AND b.index_mes = a.index_mes
 AND ( (a.index_nome='IGMP' AND b.index_nome='IGP-M')
    OR (a.index_nome='SALÁRIO' AND b.index_nome='SALÁRIO MÍNIMO') );
-- Se a consulta acima voltar linhas, apagar as duplicatas antigas antes de rodar os UPDATEs:
--   DELETE FROM indices_economicos WHERE index_nome IN ('IGMP','SALÁRIO')
--     AND (index_nome, index_ano, index_mes) ... ; -- decidir caso a caso

-- ---- aplicar ----
BEGIN;

UPDATE indices_economicos SET index_nome = 'IGP-M'          WHERE index_nome = 'IGMP';
UPDATE indices_economicos SET index_nome = 'SALÁRIO MÍNIMO' WHERE index_nome = 'SALÁRIO';

UPDATE precos_cliente SET pc_cod_index = 'IGP-M'          WHERE pc_cod_index = 'IGMP';
UPDATE precos_cliente SET pc_cod_index = 'SALÁRIO MÍNIMO' WHERE pc_cod_index = 'SALÁRIO';

-- confira: nao deve sobrar nenhuma linha 'IGMP' nem 'SALÁRIO'
SELECT count(*) AS ainda_igmp_ou_salario
FROM (
  SELECT index_nome FROM indices_economicos WHERE index_nome IN ('IGMP','SALÁRIO')
  UNION ALL
  SELECT pc_cod_index FROM precos_cliente WHERE pc_cod_index IN ('IGMP','SALÁRIO')
) t;

COMMIT;
