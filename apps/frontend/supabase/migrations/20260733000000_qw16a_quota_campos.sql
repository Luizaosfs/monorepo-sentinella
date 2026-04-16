-- QW-16 Sprint A — Novos campos de quota + view atualizada + triggers faltantes
-- Adiciona: vistorias_mes, ia_calls_mes, storage_gb
-- Triggers novos: usuarios (hard block) e levantamentos (bloqueia >150%)

-- ─── 1. Novos campos em cliente_quotas ───────────────────────────────────────
ALTER TABLE cliente_quotas
  ADD COLUMN IF NOT EXISTS vistorias_mes integer     CHECK (vistorias_mes > 0),
  ADD COLUMN IF NOT EXISTS ia_calls_mes  integer     CHECK (ia_calls_mes  > 0),
  ADD COLUMN IF NOT EXISTS storage_gb    numeric(8,2) CHECK (storage_gb   > 0);

-- ─── 2. Recria v_cliente_uso_mensal com novas métricas ───────────────────────
DROP VIEW IF EXISTS v_cliente_uso_mensal;

CREATE VIEW v_cliente_uso_mensal AS
SELECT
  c.id   AS cliente_id,
  c.nome AS cliente_nome,

  -- voos
  (SELECT COUNT(*)::int FROM voos
   WHERE cliente_id = c.id
   AND created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
  ) AS voos_mes_usado,
  cq.voos_mes AS voos_mes_limite,

  -- levantamentos
  (SELECT COUNT(*)::int FROM levantamentos
   WHERE cliente_id = c.id
   AND created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
  ) AS levantamentos_mes_usado,
  cq.levantamentos_mes AS levantamentos_mes_limite,

  -- itens
  (SELECT COUNT(*)::int FROM levantamento_itens li
   JOIN levantamentos lev ON lev.id = li.levantamento_id
   WHERE lev.cliente_id = c.id
   AND li.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
  ) AS itens_mes_usado,
  cq.itens_mes AS itens_mes_limite,

  -- usuarios ativos (total, não mensal)
  (SELECT COUNT(*)::int FROM usuarios
   WHERE cliente_id = c.id AND ativo = true
  ) AS usuarios_ativos_usado,
  cq.usuarios_ativos AS usuarios_ativos_limite,

  -- vistorias
  (SELECT COUNT(*)::int FROM vistorias
   WHERE cliente_id = c.id
   AND created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
  ) AS vistorias_mes_usado,
  cq.vistorias_mes AS vistorias_mes_limite,

  -- ia_calls (triagens com status sucesso no mês)
  (SELECT COUNT(*)::int FROM levantamento_analise_ia ia
   JOIN levantamentos lev ON lev.id = ia.levantamento_id
   WHERE lev.cliente_id = c.id
   AND ia.status = 'sucesso'
   AND ia.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
  ) AS ia_calls_mes_usado,
  cq.ia_calls_mes AS ia_calls_mes_limite,

  -- storage (último snapshot de billing; NULL se ainda sem snapshot)
  COALESCE(
    (SELECT storage_gb FROM billing_usage_snapshot
     WHERE cliente_id = c.id ORDER BY periodo_inicio DESC LIMIT 1),
    0
  ) AS storage_gb_usado,
  cq.storage_gb AS storage_gb_limite,

  -- flags excedido (existentes)
  (cq.voos_mes IS NOT NULL AND
   (SELECT COUNT(*) FROM voos WHERE cliente_id = c.id
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
   ) > cq.voos_mes
  ) AS voos_excedido,

  (cq.levantamentos_mes IS NOT NULL AND
   (SELECT COUNT(*) FROM levantamentos WHERE cliente_id = c.id
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
   ) > cq.levantamentos_mes
  ) AS levantamentos_excedido,

  (cq.itens_mes IS NOT NULL AND
   (SELECT COUNT(*) FROM levantamento_itens li
    JOIN levantamentos lev ON lev.id = li.levantamento_id
    WHERE lev.cliente_id = c.id
    AND li.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
   ) > cq.itens_mes
  ) AS itens_excedido,

  (cq.usuarios_ativos IS NOT NULL AND
   (SELECT COUNT(*) FROM usuarios WHERE cliente_id = c.id AND ativo = true
   ) > cq.usuarios_ativos
  ) AS usuarios_excedido,

  -- flags excedido (novos)
  (cq.vistorias_mes IS NOT NULL AND
   (SELECT COUNT(*) FROM vistorias WHERE cliente_id = c.id
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
   ) > cq.vistorias_mes
  ) AS vistorias_excedido,

  (cq.ia_calls_mes IS NOT NULL AND
   (SELECT COUNT(*) FROM levantamento_analise_ia ia
    JOIN levantamentos lev ON lev.id = ia.levantamento_id
    WHERE lev.cliente_id = c.id AND ia.status = 'sucesso'
    AND ia.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
   ) > cq.ia_calls_mes
  ) AS ia_calls_excedido

FROM clientes c
LEFT JOIN cliente_quotas cq ON cq.cliente_id = c.id
WHERE c.deleted_at IS NULL;

GRANT SELECT ON v_cliente_uso_mensal TO authenticated;

-- ─── 3. Atualiza RPC cliente_verificar_quota com novos campos ─────────────────
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
  v_usado  numeric;
  v_limite numeric;
  v_mes    timestamptz;
BEGIN
  v_mes := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo');

  IF p_metrica = 'voos_mes' THEN
    SELECT COUNT(*) INTO v_usado
    FROM voos WHERE cliente_id = p_cliente_id AND created_at >= v_mes;
    SELECT voos_mes INTO v_limite FROM cliente_quotas WHERE cliente_id = p_cliente_id;

  ELSIF p_metrica = 'levantamentos_mes' THEN
    SELECT COUNT(*) INTO v_usado
    FROM levantamentos WHERE cliente_id = p_cliente_id AND created_at >= v_mes;
    SELECT levantamentos_mes INTO v_limite FROM cliente_quotas WHERE cliente_id = p_cliente_id;

  ELSIF p_metrica = 'itens_mes' THEN
    SELECT COUNT(*) INTO v_usado
    FROM levantamento_itens li
    JOIN levantamentos lev ON lev.id = li.levantamento_id
    WHERE lev.cliente_id = p_cliente_id AND li.created_at >= v_mes;
    SELECT itens_mes INTO v_limite FROM cliente_quotas WHERE cliente_id = p_cliente_id;

  ELSIF p_metrica = 'usuarios_ativos' THEN
    SELECT COUNT(*) INTO v_usado
    FROM usuarios WHERE cliente_id = p_cliente_id AND ativo = true;
    SELECT usuarios_ativos INTO v_limite FROM cliente_quotas WHERE cliente_id = p_cliente_id;

  ELSIF p_metrica = 'vistorias_mes' THEN
    SELECT COUNT(*) INTO v_usado
    FROM vistorias WHERE cliente_id = p_cliente_id AND created_at >= v_mes;
    SELECT vistorias_mes INTO v_limite FROM cliente_quotas WHERE cliente_id = p_cliente_id;

  ELSIF p_metrica = 'ia_calls_mes' THEN
    SELECT COUNT(*) INTO v_usado
    FROM levantamento_analise_ia ia
    JOIN levantamentos lev ON lev.id = ia.levantamento_id
    WHERE lev.cliente_id = p_cliente_id
    AND ia.status = 'sucesso'
    AND ia.created_at >= v_mes;
    SELECT ia_calls_mes INTO v_limite FROM cliente_quotas WHERE cliente_id = p_cliente_id;

  ELSIF p_metrica = 'storage_gb' THEN
    SELECT COALESCE(storage_gb, 0) INTO v_usado
    FROM billing_usage_snapshot
    WHERE cliente_id = p_cliente_id ORDER BY periodo_inicio DESC LIMIT 1;
    SELECT cq.storage_gb INTO v_limite FROM cliente_quotas cq WHERE cq.cliente_id = p_cliente_id;

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

-- ─── 4. Trigger: bloquear criação de usuário acima do limite ─────────────────
CREATE OR REPLACE FUNCTION fn_check_quota_usuarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limite integer;
  v_usado  integer;
BEGIN
  SELECT usuarios_ativos INTO v_limite
  FROM cliente_quotas WHERE cliente_id = NEW.cliente_id;

  -- NULL = ilimitado
  IF v_limite IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_usado
  FROM usuarios WHERE cliente_id = NEW.cliente_id AND ativo = true;

  IF v_usado >= v_limite THEN
    RAISE EXCEPTION 'quota_usuarios_excedida: limite=% usado=%', v_limite, v_usado
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_quota_usuarios ON usuarios;
CREATE TRIGGER trg_check_quota_usuarios
  BEFORE INSERT ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_check_quota_usuarios();

-- ─── 5. Trigger: bloquear levantamentos acima de 150% do limite (carência) ───
CREATE OR REPLACE FUNCTION fn_check_quota_levantamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limite integer;
  v_usado  integer;
  v_mes    timestamptz;
BEGIN
  SELECT levantamentos_mes INTO v_limite
  FROM cliente_quotas WHERE cliente_id = NEW.cliente_id;

  -- NULL = ilimitado
  IF v_limite IS NULL THEN
    RETURN NEW;
  END IF;

  v_mes := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo');

  SELECT COUNT(*) INTO v_usado
  FROM levantamentos
  WHERE cliente_id = NEW.cliente_id AND created_at >= v_mes;

  -- Carência de 50%: só bloqueia acima de 150% do limite
  IF v_usado >= (v_limite * 1.5)::int THEN
    RAISE EXCEPTION 'quota_levantamentos_excedida: limite=% usado=% (carencia_150pct)', v_limite, v_usado
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_quota_levantamentos ON levantamentos;
CREATE TRIGGER trg_check_quota_levantamentos
  BEFORE INSERT ON levantamentos
  FOR EACH ROW EXECUTE FUNCTION fn_check_quota_levantamentos();
