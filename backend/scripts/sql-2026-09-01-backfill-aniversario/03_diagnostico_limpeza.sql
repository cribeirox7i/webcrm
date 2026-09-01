-- Diagnóstico antes de limpar: quantos pc_id têm pc_dat_ult_reajuste preenchido hoje e NÃO
-- estão entre os 70 confiáveis (planilha tabela_precos_2026-07 - V2.xlsx) -- são os que vieram
-- da carga de agosto (planilha errada, sql-2026-08-28-indices/05_backfill_ult_reajuste.sql) e
-- vão ser zerados pelo 04_limpar_ultimo_reajuste.sql. Só SELECT, não grava nada.

SELECT count(*) AS sera_zerado
FROM precos_cliente
WHERE pc_dat_ult_reajuste IS NOT NULL
  AND pc_id NOT IN (
    21428, 21529, 21811, 21815, 21834, 21857, 21860, 21935, 22217, 22221, 22240, 22264, 22267,
    22625, 22745, 23025, 23048, 23072, 23075, 23510, 23514, 23520, 23540, 23547, 23549, 23558,
    23559, 23580, 23641, 23727, 23763, 23775, 23786, 23814, 23825, 23828, 23857, 23860, 23864,
    23871, 23872, 23874, 23878, 23880, 23896, 23932, 23941, 23970, 24035, 24044, 24051, 24076,
    24097, 24100, 24102, 24106, 24107, 24113, 24950, 24967, 24975, 24982, 24989, 25070, 25098,
    25108, 25129, 25131, 25135, 25341
  );
-- esperado: 2373 - 70 = 2303 (o total com data preenchida hoje, menos os 70 confiáveis que
-- ficam intocados)

-- conferência: quantos ficam com pc_dat_ult_reajuste preenchido DEPOIS da limpeza -- tem que
-- bater exatamente com os 70 confiáveis
SELECT count(*) AS continua_preenchido_depois
FROM precos_cliente
WHERE pc_id IN (
    21428, 21529, 21811, 21815, 21834, 21857, 21860, 21935, 22217, 22221, 22240, 22264, 22267,
    22625, 22745, 23025, 23048, 23072, 23075, 23510, 23514, 23520, 23540, 23547, 23549, 23558,
    23559, 23580, 23641, 23727, 23763, 23775, 23786, 23814, 23825, 23828, 23857, 23860, 23864,
    23871, 23872, 23874, 23878, 23880, 23896, 23932, 23941, 23970, 24035, 24044, 24051, 24076,
    24097, 24100, 24102, 24106, 24107, 24113, 24950, 24967, 24975, 24982, 24989, 25070, 25098,
    25108, 25129, 25131, 25135, 25341
  )
  AND pc_dat_ult_reajuste IS NOT NULL;
-- esperado: 70
