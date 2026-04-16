-- =============================================================================
-- FASE 0: Adicionar valor 'agente' ao enum papel_app
--
-- DEVE ser a ÚNICA instrução nesta migration.
-- Motivo: ALTER TYPE ... ADD VALUE não pode ser usada na mesma transação
-- que já referencia o novo valor (SQLSTATE 55P04).
-- O próximo arquivo (20261015000001) faz a migração de dados e funções.
-- =============================================================================

ALTER TYPE public.papel_app ADD VALUE IF NOT EXISTS 'agente';
