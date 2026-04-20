-- Remove o índice uniq_vistoria_imovel_agente_ciclo_data (criado em 20260713, corrigido em 20260801).
--
-- O objetivo original era evitar duplicatas de vistorias offline para o mesmo
-- imóvel/agente/ciclo/dia. Esse papel já é cumprido com mais precisão por
-- uq_vistorias_idempotency_key (migration 20260740): o frontend gera um UUID
-- estável por sessão de formulário e o RPC retorna o id existente em caso de reenvio.
--
-- O índice de data impede o fluxo legítimo em que o agente tenta acessar um
-- imóvel mais de uma vez no mesmo dia (ex: manhã sem acesso → tarde entra).
-- Esse cenário é central para a contagem de tentativas e o trigger de drone.

DROP INDEX IF EXISTS public.uniq_vistoria_imovel_agente_ciclo_data;
