-- Enforcement de quota de itens mensais em levantamento_itens.
-- Complementa o trigger de voos (20260319241000) para o campo itens_mes.
-- A verificação client-side existe (api.quotas.verificar), mas este trigger
-- garante o limite mesmo em chamadas diretas à API.

CREATE OR REPLACE FUNCTION fn_check_quota_itens()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_cliente_id  uuid;
  v_limite      integer;
  v_utilizado   integer;
BEGIN
  -- Resolver cliente_id via levantamento pai (levantamento_itens não tem cliente_id direto)
  SELECT l.cliente_id INTO v_cliente_id
  FROM levantamentos l
  WHERE l.id = NEW.levantamento_id;

  IF v_cliente_id IS NULL THEN
    RETURN NEW; -- levantamento não encontrado, FK vai rejeitar
  END IF;

  SELECT itens_mes INTO v_limite
  FROM cliente_quotas
  WHERE cliente_id = v_cliente_id;

  -- NULL = ilimitado
  IF v_limite IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_utilizado
  FROM levantamento_itens li
  JOIN levantamentos l ON l.id = li.levantamento_id
  WHERE l.cliente_id = v_cliente_id
    AND date_trunc('month', li.created_at) = date_trunc('month', now());

  IF v_utilizado >= v_limite THEN
    RAISE EXCEPTION 'quota_itens_excedida: cliente % atingiu o limite de % itens/mês (uso atual: %)',
      v_cliente_id, v_limite, v_utilizado
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_check_quota_itens ON levantamento_itens;
CREATE TRIGGER trg_check_quota_itens
  BEFORE INSERT ON levantamento_itens
  FOR EACH ROW EXECUTE FUNCTION fn_check_quota_itens();
