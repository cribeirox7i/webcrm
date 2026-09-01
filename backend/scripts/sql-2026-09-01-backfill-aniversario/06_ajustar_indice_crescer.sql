-- CRESCER SECURITIZADORA S.A. (pc_id 23828 e 25108) veio com "Índice de Reajuste" em branco na
-- planilha (não é perda de dado nossa, já estava assim na origem) -- usuário confirmou que o
-- indexador certo é IPCA (2026-09-01). Só esses 2 contratos, confirmados por cliente_nome +
-- pc_id como conferência extra. Idempotente.

BEGIN;

UPDATE precos_cliente pc
SET pc_cod_index = 'IPCA'
FROM clientes c
WHERE pc.cliente_id = c.cliente_id
  AND pc.pc_id IN (23828, 25108)
  AND c.cliente_nome = 'CRESCER SECURITIZADORA S.A.';

COMMIT;

-- roda separado, depois do COMMIT acima -- as 2 linhas devem aparecer com pc_cod_index = 'IPCA'
SELECT pc.pc_id, c.cliente_nome, pc.pc_cod_index
FROM precos_cliente pc
JOIN clientes c ON c.cliente_id = pc.cliente_id
WHERE pc.pc_id IN (23828, 25108);
