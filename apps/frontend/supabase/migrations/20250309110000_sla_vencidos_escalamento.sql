-- =============================================================================
-- M8 — SLA: marcar vencidos automaticamente + escalamento de prioridade
-- 1. escalar_prioridade(text)           — helper: próximo nível de prioridade
-- 2. marcar_slas_vencidos(cliente_id)   — marca expirados como 'vencido'
-- 3. escalar_sla_operacional(sla_id)    — escala SLA para prioridade superior
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper imutável: próxima prioridade na escala
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.escalar_prioridade(p_prioridade text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(p_prioridade))
    WHEN 'monitoramento' THEN 'Baixa'
    WHEN 'baixa'         THEN 'Média'
    WHEN 'média'         THEN 'Alta'
    WHEN 'media'         THEN 'Alta'
    WHEN 'moderada'      THEN 'Alta'
    WHEN 'alta'          THEN 'Urgente'
    WHEN 'urgente'       THEN 'Urgente'
    WHEN 'crítica'       THEN 'Crítica'
    WHEN 'critica'       THEN 'Crítica'
    ELSE p_prioridade
  END;
$$;

COMMENT ON FUNCTION public.escalar_prioridade(text) IS
  'Retorna a próxima prioridade mais alta na escala: Monitoramento→Baixa→Média→Alta→Urgente. '
  'Urgente e Crítica são o topo e permanecem inalterados.';

-- -----------------------------------------------------------------------------
-- 2. Marcar SLAs vencidos (chamado periodicamente pelo frontend ou por job)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_slas_vencidos(p_cliente_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.sla_operacional s
  SET
    status  = 'vencido',
    violado = true
  FROM public.pluvio_operacional_item it
  JOIN public.pluvio_operacional_run   r ON r.id = it.run_id
  WHERE s.item_id    = it.id
    AND s.status     IN ('pendente', 'em_atendimento')
    AND s.prazo_final < now()
    AND (p_cliente_id IS NULL OR r.cliente_id = p_cliente_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_slas_vencidos(uuid) TO authenticated;

COMMENT ON FUNCTION public.marcar_slas_vencidos(uuid) IS
  'Marca como vencido (e violado) todos os SLAs cujo prazo_final < now() e que '
  'ainda estão pendente ou em_atendimento. Aceita cliente_id opcional. '
  'Retorna a quantidade de registros atualizados.';

-- -----------------------------------------------------------------------------
-- 3. Escalar um SLA: aumenta prioridade e recalcula o prazo
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.escalar_sla_operacional(p_sla_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla         public.sla_operacional%ROWTYPE;
  v_nova_prio   text;
  v_cliente_id  uuid;
  v_config      jsonb;
  v_horas_base  int;
  v_horas_final int;
  v_item        public.pluvio_operacional_item%ROWTYPE;
  v_agora       timestamptz := now();
BEGIN
  SELECT * INTO v_sla FROM public.sla_operacional WHERE id = p_sla_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLA não encontrado: %', p_sla_id;
  END IF;

  IF v_sla.status = 'concluido' THEN
    RAISE EXCEPTION 'SLA já concluído; não é possível escalar.';
  END IF;

  v_nova_prio := public.escalar_prioridade(v_sla.prioridade);

  -- Se já está no topo da escala, não altera
  IF lower(trim(v_nova_prio)) = lower(trim(v_sla.prioridade)) THEN
    RETURN jsonb_build_object(
      'escalado',  false,
      'mensagem',  'Prioridade já está no nível máximo (' || v_sla.prioridade || ').'
    );
  END IF;

  -- Obtém config do cliente para recalcular o prazo
  SELECT r.cliente_id INTO v_cliente_id
  FROM public.pluvio_operacional_item it
  JOIN public.pluvio_operacional_run   r ON r.id = it.run_id
  WHERE it.id = v_sla.item_id;

  SELECT c.config INTO v_config
  FROM public.sla_config c
  WHERE c.cliente_id = v_cliente_id
  LIMIT 1;

  SELECT * INTO v_item
  FROM public.pluvio_operacional_item
  WHERE id = v_sla.item_id;

  v_horas_base  := public.sla_horas_from_config(v_config, v_nova_prio);
  v_horas_final := public.sla_aplicar_fatores(
    v_horas_base,
    v_config,
    v_item.classificacao_risco,
    v_item.persistencia_7d,
    v_item.temp_media_c
  );

  UPDATE public.sla_operacional
  SET
    -- Preserva a prioridade original (só na primeira escalada)
    prioridade_original = COALESCE(prioridade_original, prioridade),
    prioridade          = v_nova_prio,
    sla_horas           = v_horas_final,
    inicio              = v_agora,
    prazo_final         = v_agora + (v_horas_final || ' hours')::interval,
    escalonado          = true,
    escalonado_em       = v_agora,
    -- SLA vencido volta a pendente ao ser escalado
    status              = CASE WHEN status = 'vencido' THEN 'pendente' ELSE status END,
    violado             = CASE WHEN status = 'vencido' THEN violado    ELSE violado END
  WHERE id = p_sla_id;

  RETURN jsonb_build_object(
    'escalado',            true,
    'prioridade_anterior', v_sla.prioridade,
    'prioridade_nova',     v_nova_prio,
    'sla_horas',           v_horas_final
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.escalar_sla_operacional(uuid) TO authenticated;

COMMENT ON FUNCTION public.escalar_sla_operacional(uuid) IS
  'Escala um SLA para a próxima prioridade mais alta, recalcula o prazo usando sla_config '
  'e marca escalonado=true. Se o SLA estava vencido, volta para pendente. '
  'Retorna JSON com resultado da operação.';
