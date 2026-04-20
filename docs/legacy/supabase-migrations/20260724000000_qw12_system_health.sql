-- =============================================================================
-- QW-12 — Monitoramento externo, health checks e alertas proativos
-- =============================================================================
-- Tabelas:
--   system_health_log — log de cada verificação de serviço
--   system_alerts     — alertas ativos e histórico de incidentes
-- =============================================================================

-- ── 1. system_health_log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.system_health_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  servico    text        NOT NULL,
  status     text        NOT NULL
               CHECK (status IN ('ok', 'erro', 'aviso')),
  detalhes   jsonb,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_health_log IS
  'Registro de cada verificação de health check por serviço. '
  'Populado pela Edge Function health-check (cron + manual). '
  'Não é por cliente — escopo de plataforma. (QW-12)';

CREATE INDEX IF NOT EXISTS idx_system_health_log_servico_criado
  ON public.system_health_log (servico, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_system_health_log_criado
  ON public.system_health_log (criado_em DESC);

ALTER TABLE public.system_health_log ENABLE ROW LEVEL SECURITY;

-- Somente admin e supervisor podem ler (escopo de plataforma, não por cliente)
CREATE POLICY "health_log_admin_leitura" ON public.system_health_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel IN ('admin', 'supervisor')
    )
  );

-- Inserção liberada sem RLS — a Edge Function usa service_role e contorna RLS
-- RLS de INSERT não é necessária; o service_role já bypassa.

-- ── 2. system_alerts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.system_alerts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  servico       text        NOT NULL,
  nivel         text        NOT NULL
                  CHECK (nivel IN ('info', 'warning', 'critical')),
  mensagem      text        NOT NULL,
  resolvido     boolean     NOT NULL DEFAULT false,
  resolvido_em  timestamptz,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_alerts IS
  'Alertas operacionais gerados pelo health-check. '
  'Resolvidos manualmente pelo admin ou automaticamente quando o serviço volta ao normal. '
  'Escopo de plataforma — não é por cliente. (QW-12)';

CREATE INDEX IF NOT EXISTS idx_system_alerts_ativos
  ON public.system_alerts (nivel, criado_em DESC)
  WHERE resolvido = false;

CREATE INDEX IF NOT EXISTS idx_system_alerts_servico
  ON public.system_alerts (servico, criado_em DESC);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_admin_leitura" ON public.system_alerts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel IN ('admin', 'supervisor')
    )
  );

CREATE POLICY "alerts_admin_update" ON public.system_alerts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel IN ('admin')
    )
  );

-- ── 3. View: status atual por serviço ────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_system_health_atual AS
SELECT DISTINCT ON (servico)
  id,
  servico,
  status,
  detalhes,
  criado_em
FROM public.system_health_log
ORDER BY servico, criado_em DESC;

COMMENT ON VIEW public.v_system_health_atual IS
  'Status mais recente de cada serviço monitorado. (QW-12)';
