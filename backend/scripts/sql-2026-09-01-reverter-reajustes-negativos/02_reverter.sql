-- Reverte os 12 reajustes retroativos com acumulado negativo: precos_cliente volta pro valor de
-- antes (reaj_vlr_unit_ant/reaj_vlr_franquia_ant) e o evento sai do histórico. Ordem importa: o
-- UPDATE lê de reajuste_eventos, então precisa rodar ANTES do DELETE.
-- Não idempotente por natureza (2ª execução não acha mais nada com taxa < 0 -- fica sem efeito,
-- o que é o comportamento correto de "já foi revertido").

BEGIN;

UPDATE precos_cliente pc
SET
    pc_vlr_unit = re.reaj_vlr_unit_ant,
    pc_vlr_franquia = re.reaj_vlr_franquia_ant
FROM reajuste_eventos re
WHERE pc.pc_id = re.pc_id
  AND re.reaj_taxa_acum_12m < 0;

DELETE FROM reajuste_eventos WHERE reaj_taxa_acum_12m < 0;

COMMIT;

-- confira depois do COMMIT (rodar separado): tem que dar 0
SELECT count(*) AS restam_negativos FROM reajuste_eventos WHERE reaj_taxa_acum_12m < 0;
