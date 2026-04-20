-- Remove a constraint uq_vistoria_imovel_agente_dia (H-01, migration 20260605).
--
-- O objetivo original era evitar duplicatas de vistorias offline.
-- Esse papel já é cumprido por uq_vistorias_idempotency_key (migration 20260740).
--
-- O constraint de unicidade por dia impede o fluxo legítimo onde o agente
-- tenta acessar o mesmo imóvel mais de uma vez no mesmo dia
-- (ex.: manhã sem acesso → tarde retorna e entra), quebrando a lógica de
-- contagem de tentativas sem acesso e o trigger de prioridade de drone.

ALTER TABLE vistorias
  DROP CONSTRAINT IF EXISTS uq_vistoria_imovel_agente_dia;
