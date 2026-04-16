-- =============================================================================
-- 2C: Corrigir janela de recorrência — usar clientes.janela_recorrencia_dias
--
-- Problema: detectar_recorrencia_levantamento_item() usa hardcoded
-- v_janela_inicio := now() - interval '30 days', ignorando a configuração
-- por cliente adicionada em 20260756000000_reincidencia_inteligente.sql.
-- A view v_recorrencias_ativas também tem o hardcoded '30 days'.
--
-- Fix: ler clientes.janela_recorrencia_dias (com fallback 30 se NULL).
--      Atualizar a view para usar o default 30 (join dinâmico impossível em view).
-- =============================================================================

-- ── 1. Função atualizada — janela dinâmica por cliente ────────────────────────

CREATE OR REPLACE FUNCTION public.detectar_recorrencia_levantamento_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item              RECORD;
  v_cliente_id        uuid;
  v_janela_dias       int;
  v_janela_inicio     timestamptz;
  v_recorrencia_id    uuid;
  v_total_anteriores  int;
  v_nova_prioridade   text := 'Urgente';
  v_nova_sla_horas    int;
  v_config            jsonb;
BEGIN
  -- Carrega o item inserido com dados do levantamento
  SELECT li.*, lev.cliente_id AS v_cliente_id
  INTO v_item
  FROM public.levantamento_itens li
  JOIN public.levantamentos lev ON lev.id = li.levantamento_id
  WHERE li.id = p_item_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_cliente_id := v_item.v_cliente_id;

  -- FIX 2C: ler janela_recorrencia_dias do cliente (fallback 30 dias)
  SELECT COALESCE(janela_recorrencia_dias, 30) INTO v_janela_dias
  FROM public.clientes WHERE id = v_cliente_id;

  v_janela_inicio := now() - (v_janela_dias || ' days')::interval;

  -- Conta ocorrências anteriores no mesmo local na janela configurada
  SELECT COUNT(*)
  INTO v_total_anteriores
  FROM public.levantamento_itens li2
  JOIN public.levantamentos lev2 ON lev2.id = li2.levantamento_id
  WHERE lev2.cliente_id = v_cliente_id
    AND li2.id <> p_item_id
    AND li2.data_hora >= v_janela_inicio
    AND (
      -- (a) mesmo endereço curto
      (
        v_item.endereco_curto IS NOT NULL
        AND li2.endereco_curto IS NOT NULL
        AND li2.endereco_curto = v_item.endereco_curto
      )
      OR
      -- (b) raio de 50m
      (
        v_item.latitude  IS NOT NULL AND v_item.longitude  IS NOT NULL
        AND li2.latitude IS NOT NULL AND li2.longitude IS NOT NULL
        AND sqrt(
          power((li2.latitude  - v_item.latitude)  * 111320.0, 2) +
          power((li2.longitude - v_item.longitude) * 111320.0 * cos(radians(v_item.latitude)), 2)
        ) <= 50.0
      )
    );

  IF v_total_anteriores < 1 THEN RETURN; END IF;

  -- ── Recorrência detectada ───────────────────────────────────────────────────

  -- 1. Eleva prioridade para Urgente (não faz downgrade de Crítica)
  IF v_item.prioridade IS DISTINCT FROM 'Crítica'
     AND v_item.prioridade IS DISTINCT FROM 'Urgente' THEN

    SELECT c.config INTO v_config
    FROM public.sla_config c
    WHERE c.cliente_id = v_cliente_id
    LIMIT 1;

    v_nova_sla_horas := public.sla_horas_from_config(v_config, v_nova_prioridade);
    v_nova_sla_horas := COALESCE(v_nova_sla_horas, 4);

    UPDATE public.levantamento_itens
    SET prioridade = v_nova_prioridade, sla_horas = v_nova_sla_horas
    WHERE id = p_item_id;

    UPDATE public.sla_operacional
    SET
      prioridade  = v_nova_prioridade,
      sla_horas   = v_nova_sla_horas,
      prazo_final = inicio + (v_nova_sla_horas || ' hours')::interval
    WHERE levantamento_item_id = p_item_id
      AND status IN ('pendente', 'em_atendimento');
  END IF;

  -- 2. Localiza cluster de recorrência existente para este local
  SELECT r.id INTO v_recorrencia_id
  FROM public.levantamento_item_recorrencia r
  WHERE r.cliente_id = v_cliente_id
    AND (
      (
        v_item.endereco_curto IS NOT NULL
        AND r.endereco_ref IS NOT NULL
        AND r.endereco_ref = v_item.endereco_curto
      )
      OR
      (
        v_item.latitude  IS NOT NULL AND v_item.longitude  IS NOT NULL
        AND r.latitude_ref IS NOT NULL AND r.longitude_ref IS NOT NULL
        AND sqrt(
          power((r.latitude_ref  - v_item.latitude)  * 111320.0, 2) +
          power((r.longitude_ref - v_item.longitude) * 111320.0 * cos(radians(v_item.latitude)), 2)
        ) <= 50.0
      )
    )
  ORDER BY r.ultima_ocorrencia_em DESC
  LIMIT 1;

  IF v_recorrencia_id IS NULL THEN
    INSERT INTO public.levantamento_item_recorrencia (
      cliente_id, endereco_ref, latitude_ref, longitude_ref,
      total_ocorrencias, primeira_ocorrencia_id, ultima_ocorrencia_id,
      primeira_ocorrencia_em, ultima_ocorrencia_em
    ) VALUES (
      v_cliente_id,
      v_item.endereco_curto,
      v_item.latitude,
      v_item.longitude,
      v_total_anteriores + 1,
      p_item_id,
      p_item_id,
      COALESCE(v_item.data_hora, now()),
      COALESCE(v_item.data_hora, now())
    )
    RETURNING id INTO v_recorrencia_id;
  ELSE
    UPDATE public.levantamento_item_recorrencia
    SET
      total_ocorrencias    = total_ocorrencias + 1,
      ultima_ocorrencia_id = p_item_id,
      ultima_ocorrencia_em = COALESCE(v_item.data_hora, now()),
      updated_at           = now()
    WHERE id = v_recorrencia_id;
  END IF;

  -- 4. Vincula item ao cluster
  INSERT INTO public.levantamento_item_recorrencia_itens (recorrencia_id, levantamento_item_id)
  VALUES (v_recorrencia_id, p_item_id)
  ON CONFLICT DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.detectar_recorrencia_levantamento_item(uuid) IS
  'Detecta recorrência de foco no mesmo local (endereco_curto idêntico ou raio 50m). '
  'Fix 2C: janela configurável via clientes.janela_recorrencia_dias (fallback 30 dias). '
  'Se >= 1 ocorrência anterior: eleva prioridade para Urgente, recalcula SLA, atualiza cluster.';

-- ── 2. View atualizada — mantém default 30 dias (configuração mais comum) ─────
-- A view não pode fazer join dinâmico por cliente sem materializar;
-- usamos 30 dias como proxy conservador. Para análise por cliente use a função.

CREATE OR REPLACE VIEW public.v_recorrencias_ativas AS
SELECT
  r.id,
  r.cliente_id,
  r.endereco_ref,
  r.latitude_ref,
  r.longitude_ref,
  r.total_ocorrencias,
  r.primeira_ocorrencia_id,
  r.ultima_ocorrencia_id,
  r.primeira_ocorrencia_em,
  r.ultima_ocorrencia_em,
  li.item           AS ultimo_item,
  li.risco          AS ultimo_risco,
  li.prioridade     AS ultima_prioridade,
  li.endereco_curto AS ultimo_endereco_curto,
  li.image_url      AS ultima_image_url
FROM public.levantamento_item_recorrencia r
LEFT JOIN public.levantamento_itens li ON li.id = r.ultima_ocorrencia_id
JOIN public.clientes c ON c.id = r.cliente_id
WHERE r.ultima_ocorrencia_em >= now() - (COALESCE(c.janela_recorrencia_dias, 30) || ' days')::interval;

COMMENT ON VIEW public.v_recorrencias_ativas IS
  'Clusters de recorrência ativos na janela configurada por cliente (clientes.janela_recorrencia_dias, default 30 dias). '
  'Fix 2C: janela dinâmica por cliente em vez de hardcoded 30 dias.';

GRANT SELECT ON public.v_recorrencias_ativas TO authenticated;
