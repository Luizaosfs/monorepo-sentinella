-- =============================================================================
-- Fix Security: verificação de tenant em reabrir_sla() e escalar_sla_operacional()
-- Ambas têm GRANT EXECUTE TO authenticated mas não verificam se o SLA
-- pertence ao cliente do usuário autenticado. (Fix S-02)
-- =============================================================================

-- ── 1. reabrir_sla com verificação de tenant ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.reabrir_sla(p_sla_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s             RECORD;
  v_prazo_final timestamptz;
  v_user_id     uuid;
BEGIN
  SELECT id, sla_horas, cliente_id
  INTO s
  FROM public.sla_operacional
  WHERE id = p_sla_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reabrir_sla: SLA % não encontrado', p_sla_id;
  END IF;

  -- ── Verificação de tenant (Fix S-02) ──────────────────────────────────────
  IF NOT public.usuario_pode_acessar_cliente(s.cliente_id) THEN
    RAISE EXCEPTION
      'reabrir_sla: acesso negado — SLA pertence a outro cliente';
  END IF;

  BEGIN
    v_prazo_final := public.sla_calcular_prazo_final(
      now(),
      s.sla_horas,
      public.sla_resolve_config(s.cliente_id, NULL),
      s.cliente_id
    );
  EXCEPTION WHEN others THEN
    v_prazo_final := now() + (s.sla_horas || ' hours')::interval;
  END;

  SELECT id INTO v_user_id
  FROM public.usuarios
  WHERE auth_id = auth.uid();

  UPDATE public.sla_operacional
  SET
    status       = 'pendente',
    concluido_em = null,
    inicio       = now(),
    prazo_final  = v_prazo_final,
    violado      = false,
    reaberto_por = v_user_id
  WHERE id = p_sla_id;
END;
$$;

COMMENT ON FUNCTION public.reabrir_sla(uuid) IS
  'Reabre um SLA: volta para pendente, recalcula prazo, registra reaberto_por. '
  'Verifica tenant antes de agir. (QW-06 + QW-07 + Fix S-02)';

GRANT EXECUTE ON FUNCTION public.reabrir_sla(uuid) TO authenticated;

-- ── 2. escalar_sla_operacional com verificação de tenant ─────────────────────

CREATE OR REPLACE FUNCTION public.escalar_sla_operacional(p_sla_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla         public.sla_operacional%ROWTYPE;
  v_nova_prio   text;
  v_config      jsonb;
  v_horas_base  int;
  v_horas_final int;
  v_item_pluvio public.pluvio_operacional_item%ROWTYPE;
  v_regiao_id   uuid;
  v_agora       timestamptz := now();
  v_user_id     uuid;
BEGIN
  SELECT * INTO v_sla FROM public.sla_operacional WHERE id = p_sla_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLA não encontrado: %', p_sla_id;
  END IF;

  -- ── Verificação de tenant (Fix S-02) ──────────────────────────────────────
  IF NOT public.usuario_pode_acessar_cliente(v_sla.cliente_id) THEN
    RAISE EXCEPTION
      'escalar_sla_operacional: acesso negado — SLA pertence a outro cliente';
  END IF;

  IF v_sla.status = 'concluido' THEN
    RAISE EXCEPTION 'SLA já concluído; não é possível escalar.';
  END IF;

  v_nova_prio := public.escalar_prioridade(v_sla.prioridade);

  IF lower(trim(v_nova_prio)) = lower(trim(v_sla.prioridade)) THEN
    RETURN jsonb_build_object(
      'escalado', false,
      'mensagem', 'Prioridade já está no nível máximo (' || v_sla.prioridade || ').'
    );
  END IF;

  IF v_sla.levantamento_item_id IS NOT NULL THEN
    v_regiao_id := public.sla_regiao_do_item(v_sla.levantamento_item_id);
  END IF;

  v_config     := public.sla_resolve_config(v_sla.cliente_id, v_regiao_id);
  v_horas_base := public.sla_horas_from_config(v_config, v_nova_prio);

  IF v_sla.item_id IS NOT NULL THEN
    SELECT * INTO v_item_pluvio
    FROM public.pluvio_operacional_item
    WHERE id = v_sla.item_id;

    v_horas_final := public.sla_aplicar_fatores(
      v_horas_base, v_config,
      v_item_pluvio.classificacao_risco,
      v_item_pluvio.persistencia_7d,
      v_item_pluvio.temp_media_c
    );
  ELSE
    v_horas_final := v_horas_base;
  END IF;

  SELECT id INTO v_user_id
  FROM public.usuarios
  WHERE auth_id = auth.uid();

  UPDATE public.sla_operacional
  SET
    prioridade_original = COALESCE(prioridade_original, prioridade),
    prioridade          = v_nova_prio,
    sla_horas           = v_horas_final,
    inicio              = v_agora,
    prazo_final         = v_agora + (v_horas_final || ' hours')::interval,
    escalonado          = true,
    escalonado_em       = v_agora,
    escalado_por        = v_user_id,
    status              = CASE WHEN status = 'vencido' THEN 'pendente' ELSE status END,
    violado             = CASE WHEN status = 'vencido' THEN violado    ELSE violado END
  WHERE id = p_sla_id;

  RETURN jsonb_build_object(
    'escalado',            true,
    'prioridade_anterior', v_sla.prioridade,
    'prioridade_nova',     v_nova_prio,
    'sla_horas',           v_horas_final,
    'regiao_override',     v_regiao_id IS NOT NULL
  );
END;
$$;

COMMENT ON FUNCTION public.escalar_sla_operacional(uuid) IS
  'Escala SLA para próxima prioridade, recalcula prazo, registra escalado_por. '
  'Verifica tenant antes de agir. (QW-07 + Fix S-02)';

GRANT EXECUTE ON FUNCTION public.escalar_sla_operacional(uuid) TO authenticated;
