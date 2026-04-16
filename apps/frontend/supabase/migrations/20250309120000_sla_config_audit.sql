-- =============================================================================
-- SLA Config Audit — Tabela de histórico de alterações em sla_config
-- Registra cada INSERT/UPDATE/DELETE em sla_config com o diff do JSON.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela de auditoria
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sla_config_audit (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   uuid        NOT NULL,
  changed_by   uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  changed_at   timestamptz NOT NULL DEFAULT now(),
  action       text        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  config_before jsonb,
  config_after  jsonb
);

COMMENT ON TABLE public.sla_config_audit IS
  'Histórico de alterações em sla_config por cliente. '
  'Populado automaticamente pelo trigger trg_sla_config_audit.';

-- Índice para consulta por cliente (mais comum)
CREATE INDEX IF NOT EXISTS sla_config_audit_cliente_idx
  ON public.sla_config_audit (cliente_id, changed_at DESC);

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.sla_config_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_config_audit_select" ON public.sla_config_audit;
CREATE POLICY "sla_config_audit_select" ON public.sla_config_audit
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_config_audit_insert" ON public.sla_config_audit;
CREATE POLICY "sla_config_audit_insert" ON public.sla_config_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- -----------------------------------------------------------------------------
-- 3. Função do trigger (SECURITY DEFINER para bypasser RLS no INSERT)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sla_config_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_auth_uid   uuid := auth.uid();
BEGIN
  -- Resolve auth_id → usuarios.id (pode ser NULL se chamado por sistema)
  IF v_auth_uid IS NOT NULL THEN
    SELECT id INTO v_usuario_id
    FROM public.usuarios
    WHERE auth_id = v_auth_uid
    LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sla_config_audit (cliente_id, changed_by, action, config_before, config_after)
    VALUES (NEW.cliente_id, v_usuario_id, 'INSERT', NULL, NEW.config);

  ELSIF TG_OP = 'UPDATE' THEN
    -- Só registra se o config realmente mudou
    IF NEW.config IS DISTINCT FROM OLD.config THEN
      INSERT INTO public.sla_config_audit (cliente_id, changed_by, action, config_before, config_after)
      VALUES (NEW.cliente_id, v_usuario_id, 'UPDATE', OLD.config, NEW.config);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.sla_config_audit (cliente_id, changed_by, action, config_before, config_after)
    VALUES (OLD.cliente_id, v_usuario_id, 'DELETE', OLD.config, NULL);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.trg_sla_config_audit() IS
  'Registra em sla_config_audit cada INSERT/UPDATE/DELETE em sla_config. '
  'No UPDATE, só registra se config mudou de fato.';

-- -----------------------------------------------------------------------------
-- 4. Trigger em sla_config
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sla_config_audit ON public.sla_config;

CREATE TRIGGER trg_sla_config_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.sla_config
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sla_config_audit();

-- Permissão de leitura (RLS cuida do filtro por cliente)
GRANT SELECT ON public.sla_config_audit TO authenticated;
