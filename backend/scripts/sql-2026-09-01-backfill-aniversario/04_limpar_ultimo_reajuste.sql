-- Zera pc_dat_ult_reajuste em todo contrato que NÃO está entre os 70 confiáveis (planilha
-- tabela_precos_2026-07 - V2.xlsx) -- os demais carregam a data da carga em massa de agosto
-- (planilha errada), que o usuário decidiu descartar em vez de manter como "reajuste real"
-- (2026-09-01). Depois disso só os 70 contratos com dado confirmado ficam com essa data --
-- volta a ser um campo confiável, em vez de um valor genérico de carga.
-- Idempotente: re-rodar não muda nada (os que já estão NULL continuam NULL).

BEGIN;

UPDATE precos_cliente
SET pc_dat_ult_reajuste = NULL
WHERE pc_dat_ult_reajuste IS NOT NULL
  AND pc_id NOT IN (
    21428, 21529, 21811, 21815, 21834, 21857, 21860, 21935, 22217, 22221, 22240, 22264, 22267,
    22625, 22745, 23025, 23048, 23072, 23075, 23510, 23514, 23520, 23540, 23547, 23549, 23558,
    23559, 23580, 23641, 23727, 23763, 23775, 23786, 23814, 23825, 23828, 23857, 23860, 23864,
    23871, 23872, 23874, 23878, 23880, 23896, 23932, 23941, 23970, 24035, 24044, 24051, 24076,
    24097, 24100, 24102, 24106, 24107, 24113, 24950, 24967, 24975, 24982, 24989, 25070, 25098,
    25108, 25129, 25131, 25135, 25341
  );

-- confira o número de linhas afetadas com "sera_zerado" do 03_diagnostico_limpeza.sql (esperado
-- 2303) antes do COMMIT;
COMMIT;
