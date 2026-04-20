-- Migration: remove colunas deprecadas de levantamento_itens
--
-- Contexto:
--   focos_risco passou a ser o aggregate root de ciclo de vida operacional.
--   As colunas abaixo foram substituídas pelo state machine de focos_risco
--   e pelos triggers de sincronização (migration 20260710010000).
--   Toda leitura/escrita de status agora vai por focos_risco.
--
-- Dependências removidas nesta migration:
--   • trigger trg_congelar_status_atendimento  — bloqueava escrita direta
--   • trigger trg_sincronizar_status_atendimento — sincronizava foco → item
--   • RPC    contar_status_atendimento_levantamento_itens — usava colunas deprecadas

-- ── 1. Remover triggers que dependem das colunas ──────────────────────────────

-- trg_congelar fica em levantamento_itens (bloqueia escrita direta nela)
DROP TRIGGER IF EXISTS trg_congelar_status_atendimento      ON levantamento_itens;
-- trg_sincronizar fica em focos_risco (propaga status → levantamento_itens)
DROP TRIGGER IF EXISTS trg_sincronizar_status_atendimento   ON focos_risco;

DROP FUNCTION IF EXISTS fn_congelar_status_atendimento();
DROP FUNCTION IF EXISTS fn_sincronizar_status_atendimento();

-- ── 2. Remover RPC que lia as colunas ─────────────────────────────────────────

DROP FUNCTION IF EXISTS contar_status_atendimento_levantamento_itens(uuid);

-- ── 3. Remover as colunas deprecadas ─────────────────────────────────────────

ALTER TABLE levantamento_itens
  DROP COLUMN IF EXISTS status_atendimento,
  DROP COLUMN IF EXISTS acao_aplicada,
  DROP COLUMN IF EXISTS data_resolucao,
  DROP COLUMN IF EXISTS checkin_em,
  DROP COLUMN IF EXISTS checkin_latitude,
  DROP COLUMN IF EXISTS checkin_longitude,
  DROP COLUMN IF EXISTS observacao_atendimento;
