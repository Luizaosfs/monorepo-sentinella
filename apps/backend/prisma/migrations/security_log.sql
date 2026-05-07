-- Migration: security_log
-- Propósito: tabela de eventos de segurança em runtime (auth failures, access denied,
-- tenant violations, rate limit, erros internos). Diferente de audit_log (mudanças
-- em dados administrativos), security_log registra quem tentou o quê e foi bloqueado.
--
-- APLICAR MANUALMENTE: psql -U <user> -d <db> -f security_log.sql
-- NÃO aplicar automaticamente sem validação em staging primeiro.

CREATE TABLE IF NOT EXISTS security_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL,
  severity    TEXT        NOT NULL CHECK (severity IN ('info', 'warn', 'error', 'critical')),
  user_id     TEXT,                   -- usuarios.id (null se não autenticado)
  cliente_id  UUID,                   -- multitenancy — null para admin sem contexto ou anônimos
  role        TEXT,                   -- papel do usuário no momento do evento
  ip          TEXT,                   -- IP real (após trust proxy)
  user_agent  TEXT,
  method      TEXT,
  path        TEXT,
  status_code INTEGER,
  message     TEXT        NOT NULL,
  metadata    JSONB,                  -- contexto extra: required roles, reason, etc.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para as consultas mais comuns de investigação
CREATE INDEX IF NOT EXISTS idx_security_log_event_type  ON security_log (event_type);
CREATE INDEX IF NOT EXISTS idx_security_log_cliente_id  ON security_log (cliente_id);
CREATE INDEX IF NOT EXISTS idx_security_log_ip          ON security_log (ip);
CREATE INDEX IF NOT EXISTS idx_security_log_user_id     ON security_log (user_id);
CREATE INDEX IF NOT EXISTS idx_security_log_created_at  ON security_log (created_at DESC);

-- Retenção: eventos com mais de 90 dias podem ser removidos (LGPD / volume).
-- Implementar via pg_cron ou cron do JobScheduler conforme necessidade.
