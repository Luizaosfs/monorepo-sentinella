-- =============================================================================
-- SLA OPERACIONAL — Função para gerar SLAs a partir de um run pluviométrico
-- e RLS para sla_operacional, sla_config e sla_config_audit.
-- Suas tabelas sla_operacional e sla_config já existem; este arquivo só adiciona
-- a lógica de geração e as políticas de segurança.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. RLS — sla_config (por cliente_id)
-- -----------------------------------------------------------------------------
ALTER TABLE sla_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_config_select" ON sla_config;
CREATE POLICY "sla_config_select" ON sla_config FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_config_insert" ON sla_config;
CREATE POLICY "sla_config_insert" ON sla_config FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_config_update" ON sla_config;
CREATE POLICY "sla_config_update" ON sla_config FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_config_delete" ON sla_config;
CREATE POLICY "sla_config_delete" ON sla_config FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- -----------------------------------------------------------------------------
-- 2. RLS — sla_config_audit (por cliente_id)
-- -----------------------------------------------------------------------------
ALTER TABLE sla_config_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_config_audit_select" ON sla_config_audit;
CREATE POLICY "sla_config_audit_select" ON sla_config_audit FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_config_audit_insert" ON sla_config_audit;
CREATE POLICY "sla_config_audit_insert" ON sla_config_audit FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- -----------------------------------------------------------------------------
-- 3. RLS — sla_operacional (via item -> run -> cliente_id)
-- -----------------------------------------------------------------------------
ALTER TABLE sla_operacional ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_operacional_select" ON sla_operacional;
CREATE POLICY "sla_operacional_select" ON sla_operacional FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pluvio_operacional_item it
      JOIN pluvio_operacional_run r ON r.id = it.run_id
      WHERE it.id = sla_operacional.item_id
      AND public.usuario_pode_acessar_cliente(r.cliente_id)
    )
  );

DROP POLICY IF EXISTS "sla_operacional_insert" ON sla_operacional;
CREATE POLICY "sla_operacional_insert" ON sla_operacional FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pluvio_operacional_item it
      JOIN pluvio_operacional_run r ON r.id = it.run_id
      WHERE it.id = sla_operacional.item_id
      AND public.usuario_pode_acessar_cliente(r.cliente_id)
    )
  );

DROP POLICY IF EXISTS "sla_operacional_update" ON sla_operacional;
CREATE POLICY "sla_operacional_update" ON sla_operacional FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pluvio_operacional_item it
      JOIN pluvio_operacional_run r ON r.id = it.run_id
      WHERE it.id = sla_operacional.item_id
      AND public.usuario_pode_acessar_cliente(r.cliente_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pluvio_operacional_item it
      JOIN pluvio_operacional_run r ON r.id = it.run_id
      WHERE it.id = sla_operacional.item_id
      AND public.usuario_pode_acessar_cliente(r.cliente_id)
    )
  );

DROP POLICY IF EXISTS "sla_operacional_delete" ON sla_operacional;
CREATE POLICY "sla_operacional_delete" ON sla_operacional FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pluvio_operacional_item it
      JOIN pluvio_operacional_run r ON r.id = it.run_id
      WHERE it.id = sla_operacional.item_id
      AND public.usuario_pode_acessar_cliente(r.cliente_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Função: obter horas de SLA (config ou padrão)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sla_horas_from_config(
  p_config jsonb,
  p_prioridade text
) RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_horas numeric;
  v_key text;
BEGIN
  -- Tentar da config: config.prioridades[prioridade].horas
  IF p_config IS NOT NULL AND p_config ? 'prioridades' THEN
    v_key := trim(both '"' from p_prioridade);
    IF p_config->'prioridades' ? v_key THEN
      v_horas := (p_config->'prioridades'->v_key->>'horas')::numeric;
      IF v_horas IS NOT NULL AND v_horas >= 1 THEN
        RETURN greatest(2, round(v_horas)::integer);
      END IF;
    END IF;
  END IF;

  -- Padrão (mesmo do app types/sla.ts)
  v_horas := CASE
    WHEN lower(trim(p_prioridade)) IN ('crítica', 'critica', 'urgente') THEN 4
    WHEN lower(trim(p_prioridade)) = 'alta' THEN 12
    WHEN lower(trim(p_prioridade)) IN ('moderada', 'média', 'media') THEN 24
    WHEN lower(trim(p_prioridade)) IN ('baixa', 'monitoramento') THEN 72
    ELSE 72
  END;
  RETURN greatest(2, v_horas::integer);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Função: aplicar fatores de redução (risco muito alto, persistência, temp)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sla_aplicar_fatores(
  p_horas_base integer,
  p_config jsonb,
  p_classificacao_risco text,
  p_persistencia_7d text,
  p_temp_media_c numeric
) RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_horas numeric := p_horas_base;
  v_fatores jsonb;
  v_risco_pct int;
  v_pers_pct int;
  v_temp_pct int;
  v_pers_num int;
BEGIN
  v_fatores := coalesce(p_config->'fatores', '{}'::jsonb);
  v_risco_pct := coalesce((v_fatores->>'risco_muito_alto_pct')::int, 30);
  v_pers_pct := coalesce((v_fatores->>'persistencia_pct')::int, 20);
  v_temp_pct := coalesce((v_fatores->>'temperatura_pct')::int, 10);

  -- Risco "Muito Alto" → reduz (ex.: 30%)
  IF p_classificacao_risco IS NOT NULL AND lower(trim(p_classificacao_risco)) = 'muito alto' THEN
    v_horas := v_horas * (1 - v_risco_pct / 100.0);
  END IF;

  -- Persistência 7d > 3 → reduz (ex.: 20%)
  v_pers_num := (regexp_replace(coalesce(p_persistencia_7d, '0'), '[^0-9]', '', 'g'))::int;
  IF v_pers_num > 3 THEN
    v_horas := v_horas * (1 - v_pers_pct / 100.0);
  END IF;

  -- Temperatura > 30 → reduz (ex.: 10%)
  IF p_temp_media_c IS NOT NULL AND p_temp_media_c > 30 THEN
    v_horas := v_horas * (1 - v_temp_pct / 100.0);
  END IF;

  RETURN greatest(2, round(v_horas)::integer);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Função principal: gerar SLAs para um run
-- Só insere para itens que ainda NÃO possuem SLA aberto (pendente/em_atendimento).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_slas_para_run(p_run_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_config jsonb;
  v_item record;
  v_horas_base int;
  v_horas_final int;
  v_inicio timestamptz;
  v_prazo_final timestamptz;
  v_inseridos int := 0;
BEGIN
  -- Obter cliente do run e verificar permissão
  SELECT cliente_id INTO v_cliente_id
  FROM pluvio_operacional_run
  WHERE id = p_run_id;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Run não encontrado: %', p_run_id;
  END IF;

  IF NOT public.usuario_pode_acessar_cliente(v_cliente_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerar SLA para este cliente';
  END IF;

  -- Config do cliente (pode ser null)
  SELECT config INTO v_config
  FROM sla_config
  WHERE cliente_id = v_cliente_id;

  v_inicio := now();

  FOR v_item IN
    SELECT it.id AS item_id,
           it.prioridade_operacional,
           it.classificacao_risco,
           it.persistencia_7d,
           it.temp_media_c
    FROM pluvio_operacional_item it
    WHERE it.run_id = p_run_id
    AND NOT EXISTS (
      SELECT 1 FROM sla_operacional s
      WHERE s.item_id = it.id
      AND s.status IN ('pendente', 'em_atendimento')
    )
  LOOP
    v_horas_base := public.sla_horas_from_config(v_config, v_item.prioridade_operacional);
    v_horas_final := public.sla_aplicar_fatores(
      v_horas_base,
      v_config,
      v_item.classificacao_risco,
      v_item.persistencia_7d,
      v_item.temp_media_c
    );
    v_prazo_final := v_inicio + (v_horas_final || ' hours')::interval;

    INSERT INTO sla_operacional (
      item_id,
      prioridade,
      sla_horas,
      inicio,
      prazo_final,
      status
    ) VALUES (
      v_item.item_id,
      coalesce(v_item.prioridade_operacional, 'Baixa'),
      v_horas_final,
      v_inicio,
      v_prazo_final,
      'pendente'
    );
    v_inseridos := v_inseridos + 1;
  END LOOP;

  RETURN v_inseridos;
END;
$$;

-- Permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION public.gerar_slas_para_run(uuid) TO authenticated;

COMMENT ON FUNCTION public.gerar_slas_para_run(uuid) IS
  'Gera registros em sla_operacional para todos os itens do run pluviométrico que ainda não possuem SLA aberto. Retorna a quantidade de SLAs inseridos.';
