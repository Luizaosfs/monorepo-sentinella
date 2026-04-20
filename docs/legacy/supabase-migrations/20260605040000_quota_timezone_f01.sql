-- ─────────────────────────────────────────────────────────────────────────────
-- F-01: Quota de voos usa UTC puro — corrigir para America/Sao_Paulo
-- O corte de mês agora é feito no timezone do Brasil (UTC-3), evitando que
-- voos às 22h-23h do último dia do mês no Brasil caiam no mês seguinte.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_quota_voos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_limite    integer;
  v_utilizado integer;
  v_tz        text := 'America/Sao_Paulo';
BEGIN
  SELECT voos_mes INTO v_limite
  FROM cliente_quotas
  WHERE cliente_id = NEW.cliente_id;

  IF v_limite IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_utilizado
  FROM voos
  WHERE cliente_id = NEW.cliente_id
    AND date_trunc('month', created_at AT TIME ZONE v_tz)
        = date_trunc('month', now()      AT TIME ZONE v_tz);

  IF v_utilizado >= v_limite THEN
    RAISE EXCEPTION
      'Quota de voos mensais atingida (% / %). Entre em contato para ampliar o plano.',
      v_utilizado, v_limite;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_quota_voos ON voos;
CREATE TRIGGER trg_check_quota_voos
  BEFORE INSERT ON voos
  FOR EACH ROW EXECUTE FUNCTION check_quota_voos();

COMMENT ON FUNCTION check_quota_voos() IS
  'F-01: corte de mês em America/Sao_Paulo para evitar desvio UTC na virada do mês';
