-- =============================================================================
-- 2D: Corrigir índice único de vistorias — usar DATE em vez de timestamp
--
-- Problema: uniq_vistoria_imovel_agente_ciclo_data usa data_visita como
-- timestamptz completo (criado em 20260713000000_vistoria_idempotencia_offline.sql).
-- Duas vistorias criadas no mesmo dia com timestamps diferentes (ex: 09:00 e 14:00)
-- não são bloqueadas pelo índice — deduplicação offline falha.
--
-- Fix: recriar o índice usando (data_visita AT TIME ZONE 'America/Sao_Paulo')::date
-- para garantir unicidade por DIA por imóvel/agente/ciclo.
-- =============================================================================

DROP INDEX IF EXISTS uniq_vistoria_imovel_agente_ciclo_data;

CREATE UNIQUE INDEX uniq_vistoria_imovel_agente_ciclo_data
  ON public.vistorias (
    imovel_id,
    agente_id,
    ciclo,
    CAST(timezone('America/Sao_Paulo', data_visita) AS date)
  );

COMMENT ON INDEX uniq_vistoria_imovel_agente_ciclo_data IS
  'Garante unicidade de vistoria por imóvel/agente/ciclo/dia (fuso America/Sao_Paulo). '
  'Fix 2D: índice anterior usava timestamptz completo — permitia duplicatas intra-dia.';
