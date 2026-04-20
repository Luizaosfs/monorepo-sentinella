-- =============================================================================
-- 4B: Desativar sistema legado de recorrência — levantamento_item_recorrencia
--
-- Decisão: sistema antigo (levantamento_item_recorrencia + trigger) tem 0 registros.
-- Sistema novo (focos_risco.foco_anterior_id) é a entidade operacional central.
-- Recorrência é propriedade do foco, não do item de detecção.
--
-- Verificado em 2026-03-31:
--   levantamento_item_recorrencia ativos (90d) = 0
--   focos_risco com foco_anterior_id preenchido = 0
--
-- Drop seguro: sem dados a migrar.
-- Frontend redireciona para focos_risco (ver api.recorrencias em api.ts).
-- =============================================================================

-- ── 1. Trigger e funções ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_levantamento_item_recorrencia ON public.levantamento_itens;
DROP FUNCTION IF EXISTS public.trg_levantamento_item_recorrencia();
DROP FUNCTION IF EXISTS public.detectar_recorrencia_levantamento_item(uuid);

-- ── 2. View ───────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_recorrencias_ativas;

-- ── 3. Tabelas (ordem: filha antes da mãe) ────────────────────────────────────
DROP TABLE IF EXISTS public.levantamento_item_recorrencia_itens;
DROP TABLE IF EXISTS public.levantamento_item_recorrencia;
