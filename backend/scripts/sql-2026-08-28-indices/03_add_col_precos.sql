-- ============================================================
-- 03 - Nova coluna precos_cliente.pc_dat_ult_reajuste (TEXT, ISO 'AAAA-MM-DD',
--      mesmo formato de pc_dat_niver). Idempotente.
-- ============================================================

ALTER TABLE precos_cliente ADD COLUMN IF NOT EXISTS pc_dat_ult_reajuste TEXT;

-- confere
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'precos_cliente' AND column_name = 'pc_dat_ult_reajuste';
