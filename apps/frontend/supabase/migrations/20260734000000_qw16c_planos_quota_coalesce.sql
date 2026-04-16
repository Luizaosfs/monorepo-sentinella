-- QW-16 Sprint C — Planos ditam limites de quota (COALESCE) + surto_ativo
-- Atualiza cliente_verificar_quota para COALESCE(override_individual, limite_plano).
-- Triggers de levantamentos e usuarios passam a usar o mesmo COALESCE.
-- surto_ativo em clientes bypassa enforcement de levantamentos/vistorias.

-- ─── 1. Campo surto_ativo em clientes ────────────────────────────────────────
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS surto_ativo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clientes.surto_ativo IS
  'QW-16: quando true, bypassa enforcement de quota para levantamentos e vistorias '
  'durante surtos epidemiológicos. Definido pelo admin plataforma.';

-- ─── 2. Recria cliente_verificar_quota com COALESCE(individual, plano) ───────
DROP FUNCTION IF EXISTS cliente_verificar_quota(uuid, text);

CREATE OR REPLACE FUNCTION cliente_verificar_quota(
  p_cliente_id uuid,
  p_metrica    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usado        numeric;
  v_limite_quota numeric;   -- limite override em cliente_quotas
  v_limite_plano numeric;   -- limite base do plano contratado
  v_limite       numeric;   -- limite efetivo = COALESCE(individual, plano)
  v_mes          timestamptz;
BEGIN
  v_mes := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo');

  -- Buscar limite individual e limite do plano numa única query
  SELECT
    CASE p_metrica
      WHEN 'voos_mes'          THEN cq.voos_mes
      WHEN 'levantamentos_mes' THEN cq.levantamentos_mes
      WHEN 'itens_mes'         THEN cq.itens_mes
      WHEN 'usuarios_ativos'   THEN cq.usuarios_ativos
      WHEN 'vistorias_mes'     THEN cq.vistorias_mes
      WHEN 'ia_calls_mes'      THEN cq.ia_calls_mes
      WHEN 'storage_gb'        THEN cq.storage_gb
    END,
    CASE p_metrica
      WHEN 'voos_mes'          THEN pl.limite_voos_mes
      WHEN 'levantamentos_mes' THEN pl.limite_levantamentos_mes
      WHEN 'itens_mes'         THEN NULL  -- não gerenciado pelo plano
      WHEN 'usuarios_ativos'   THEN pl.limite_usuarios
      WHEN 'vistorias_mes'     THEN pl.limite_vistorias_mes
      WHEN 'ia_calls_mes'      THEN pl.limite_ia_calls_mes
      WHEN 'storage_gb'        THEN pl.limite_storage_gb
    END
  INTO v_limite_quota, v_limite_plano
  FROM cliente_quotas cq
  LEFT JOIN cliente_plano cp ON cp.cliente_id = cq.cliente_id AND cp.status = 'ativo'
  LEFT JOIN planos pl         ON pl.id = cp.plano_id
  WHERE cq.cliente_id = p_cliente_id;

  v_limite := COALESCE(v_limite_quota, v_limite_plano);

  -- Calcular uso atual por métrica
  IF p_metrica = 'voos_mes' THEN
    SELECT COUNT(*) INTO v_usado FROM voos
    WHERE cliente_id = p_cliente_id AND created_at >= v_mes;

  ELSIF p_metrica = 'levantamentos_mes' THEN
    SELECT COUNT(*) INTO v_usado FROM levantamentos
    WHERE cliente_id = p_cliente_id AND created_at >= v_mes;

  ELSIF p_metrica = 'itens_mes' THEN
    SELECT COUNT(*) INTO v_usado FROM levantamento_itens li
    JOIN levantamentos lev ON lev.id = li.levantamento_id
    WHERE lev.cliente_id = p_cliente_id AND li.created_at >= v_mes;

  ELSIF p_metrica = 'usuarios_ativos' THEN
    SELECT COUNT(*) INTO v_usado FROM usuarios
    WHERE cliente_id = p_cliente_id AND ativo = true;

  ELSIF p_metrica = 'vistorias_mes' THEN
    SELECT COUNT(*) INTO v_usado FROM vistorias
    WHERE cliente_id = p_cliente_id AND created_at >= v_mes;

  ELSIF p_metrica = 'ia_calls_mes' THEN
    SELECT COUNT(*) INTO v_usado FROM levantamento_analise_ia ia
    JOIN levantamentos lev ON lev.id = ia.levantamento_id
    WHERE lev.cliente_id = p_cliente_id
      AND ia.status = 'sucesso'
      AND ia.created_at >= v_mes;

  ELSIF p_metrica = 'storage_gb' THEN
    SELECT COALESCE(storage_gb, 0) INTO v_usado
    FROM billing_usage_snapshot
    WHERE cliente_id = p_cliente_id ORDER BY periodo_inicio DESC LIMIT 1;

  ELSE
    RAISE EXCEPTION 'metrica_desconhecida: %', p_metrica USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'ok',     v_limite IS NULL OR COALESCE(v_usado, 0) <= v_limite,
    'usado',  COALESCE(v_usado, 0),
    'limite', v_limite
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cliente_verificar_quota(uuid, text) TO authenticated;

-- ─── 3. Recria triggers com COALESCE(individual, plano) + bypass surto ───────

-- fn_check_quota_levantamentos
CREATE OR REPLACE FUNCTION fn_check_quota_levantamentos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_surto  boolean;
  v_limite numeric;
  v_usado  integer;
  v_mes    timestamptz;
BEGIN
  -- Bypass em surto epidemiológico declarado
  SELECT surto_ativo INTO v_surto FROM clientes WHERE id = NEW.cliente_id;
  IF COALESCE(v_surto, false) THEN RETURN NEW; END IF;

  -- Limite efetivo: override individual ou limite do plano
  SELECT COALESCE(cq.levantamentos_mes, pl.limite_levantamentos_mes)
  INTO v_limite
  FROM cliente_quotas cq
  LEFT JOIN cliente_plano cp ON cp.cliente_id = cq.cliente_id AND cp.status = 'ativo'
  LEFT JOIN planos pl         ON pl.id = cp.plano_id
  WHERE cq.cliente_id = NEW.cliente_id;

  IF v_limite IS NULL THEN RETURN NEW; END IF;

  v_mes := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo');
  SELECT COUNT(*) INTO v_usado FROM levantamentos
  WHERE cliente_id = NEW.cliente_id AND created_at >= v_mes;

  -- Carência de 50%: bloqueia apenas acima de 150% do limite
  IF v_usado >= (v_limite * 1.5)::int THEN
    RAISE EXCEPTION 'quota_levantamentos_excedida: limite=% usado=% (carencia_150pct)', v_limite, v_usado
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- fn_check_quota_usuarios
CREATE OR REPLACE FUNCTION fn_check_quota_usuarios()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_limite numeric;
  v_usado  integer;
BEGIN
  SELECT COALESCE(cq.usuarios_ativos, pl.limite_usuarios)
  INTO v_limite
  FROM cliente_quotas cq
  LEFT JOIN cliente_plano cp ON cp.cliente_id = cq.cliente_id AND cp.status = 'ativo'
  LEFT JOIN planos pl         ON pl.id = cp.plano_id
  WHERE cq.cliente_id = NEW.cliente_id;

  IF v_limite IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_usado FROM usuarios
  WHERE cliente_id = NEW.cliente_id AND ativo = true;

  IF v_usado >= v_limite THEN
    RAISE EXCEPTION 'quota_usuarios_excedida: limite=% usado=%', v_limite, v_usado
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
