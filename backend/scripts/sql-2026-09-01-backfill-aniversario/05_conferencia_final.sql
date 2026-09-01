-- Conferência pós-limpeza: quantos contratos têm pc_dat_ult_reajuste preenchido agora.
SELECT count(*) AS total_com_ultimo_reajuste FROM precos_cliente WHERE pc_dat_ult_reajuste IS NOT NULL;
-- esperado: 70 (só os confiáveis da planilha boa)
