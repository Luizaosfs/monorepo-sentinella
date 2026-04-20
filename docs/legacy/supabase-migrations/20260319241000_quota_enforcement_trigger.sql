-- ─────────────────────────────────────────────────────────────────────────────
-- GRUPO 2.2 — Trigger de enforcement de quota de voos mensais
-- Impede INSERT em voos quando o cliente atingiu o limite voos_mes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_quota_voos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_limite   integer;
  v_utilizado integer;
BEGIN
  -- Busca o limite configurado para o cliente
  SELECT voos_mes INTO v_limite
  FROM cliente_quotas
  WHERE cliente_id = NEW.cliente_id;

  -- Se não há configuração de quota, permite o voo
  IF v_limite IS NULL THEN
    RETURN NEW;
  END IF;

  -- Conta voos do mês corrente
  SELECT COUNT(*) INTO v_utilizado
  FROM voos
  WHERE cliente_id = NEW.cliente_id
    AND date_trunc('month', created_at) = date_trunc('month', now());

  IF v_utilizado >= v_limite THEN
    RAISE EXCEPTION 'Quota de voos mensais atingida (% / %). Entre em contato para ampliar o plano.',
      v_utilizado, v_limite;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_quota_voos ON voos;
CREATE TRIGGER trg_check_quota_voos
  BEFORE INSERT ON voos
  FOR EACH ROW EXECUTE FUNCTION check_quota_voos();
