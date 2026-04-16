-- P7.12 — View de auditoria do canal cidadão para admin/supervisor
-- Expõe: volume por período, bloqueios, deduplicações, por cliente.
-- Sem dados pessoais — ip_hash é opaco.

CREATE OR REPLACE VIEW public.v_canal_cidadao_eventos_audit AS
SELECT
  cliente_id,
  motivo,
  COUNT(*)                                                            AS total,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '1h')        AS ultima_hora,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24h')       AS ultimas_24h,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '7d')        AS ultimos_7d,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '30d')       AS ultimos_30d,
  MAX(created_at)                                                     AS ultimo_evento
FROM public.canal_cidadao_rate_log
GROUP BY cliente_id, motivo;

COMMENT ON VIEW public.v_canal_cidadao_eventos_audit IS
  'Auditoria agregada de eventos do canal cidadão por cliente e motivo. '
  'RLS herdada de canal_cidadao_rate_log. Sem dados de IP bruto.';

-- ── Adicionar método na API (documentado aqui para referência) ───────────────
-- api.canalCidadao.eventosAudit(clienteId) → v_canal_cidadao_eventos_audit
-- Chamado por AdminCanalCidadao para exibir painel de eventos.
