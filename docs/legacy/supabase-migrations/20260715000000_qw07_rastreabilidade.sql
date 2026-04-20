-- QW-07 Rastreabilidade mínima operacional
--
-- Correção 1: escalado_por / reaberto_por em sla_operacional
--   escalar_sla_operacional() e reabrir_sla() resolvem auth.uid()→usuarios.id
--   e gravam quem realizou a ação.
--
-- Correção 2: origem_offline em vistorias
--   Coluna boolean; create_vistoria_completa() aceita o campo no payload.
--   O drainQueue() do frontend passa origem_offline=true ao sincronizar.
--
-- Correção 3: updated_by em levantamento_itens
--   Trigger BEFORE UPDATE resolve auth.uid()→usuarios.id e preenche
--   updated_by + updated_at automaticamente.

-- ── Correção 1: colunas de rastreabilidade em sla_operacional ────────────────

ALTER TABLE public.sla_operacional
  ADD COLUMN IF NOT EXISTS escalado_por uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS reaberto_por uuid REFERENCES public.usuarios(id);

COMMENT ON COLUMN public.sla_operacional.escalado_por IS
  'Usuário que disparou o escalonamento via escalar_sla_operacional(). (QW-07)';
COMMENT ON COLUMN public.sla_operacional.reaberto_por IS
  'Usuário que reabriu o SLA via reabrir_sla(). (QW-07)';

-- ── Correção 1a: reabrir_sla com reaberto_por ────────────────────────────────

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

  -- QW-07: registra quem reabriu
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
  'Reabre um SLA concluído: volta para pendente, recalcula prazo_final a partir de now() '
  'respeitando horário comercial e feriados do cliente. '
  'Registra reaberto_por com o usuário autenticado. (QW-06 + QW-07)';

GRANT EXECUTE ON FUNCTION public.reabrir_sla(uuid) TO authenticated;

-- ── Correção 1b: escalar_sla_operacional com escalado_por ────────────────────

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

  -- QW-07: registra quem escalou
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
  'Escala um SLA para a próxima prioridade e recalcula prazo. '
  'Usa sla_resolve_config para respeitar override de região quando cadastrado. '
  'Registra escalado_por com o usuário autenticado. (QW-07)';

GRANT EXECUTE ON FUNCTION public.escalar_sla_operacional(uuid) TO authenticated;

-- ── Correção 2: origem_offline em vistorias ──────────────────────────────────

ALTER TABLE public.vistorias
  ADD COLUMN IF NOT EXISTS origem_offline boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vistorias.origem_offline IS
  'true quando a vistoria foi criada offline e sincronizada posteriormente. (QW-07)';

-- Atualiza RPC para aceitar e persistir origem_offline no payload
CREATE OR REPLACE FUNCTION public.create_vistoria_completa(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vistoria_id uuid;
  v_deposito    jsonb;
  v_calha       jsonb;
BEGIN
  -- 1. Vistoria principal
  INSERT INTO vistorias (
    cliente_id, imovel_id, agente_id, planejamento_id, ciclo, tipo_atividade,
    data_visita, status, moradores_qtd, gravidas, idosos, criancas_7anos,
    lat_chegada, lng_chegada, checkin_em, observacao, payload,
    acesso_realizado, motivo_sem_acesso, proximo_horario_sugerido,
    observacao_acesso, foto_externa_url,
    origem_visita, habitat_selecionado, condicao_habitat,
    assinatura_responsavel_url,
    origem_offline
  ) VALUES (
    (p_payload->>'cliente_id')::uuid,
    (p_payload->>'imovel_id')::uuid,
    (p_payload->>'agente_id')::uuid,
    NULL,
    (p_payload->>'ciclo')::int,
    p_payload->>'tipo_atividade',
    COALESCE((p_payload->>'data_visita')::timestamptz, now()),
    COALESCE(p_payload->>'status', 'visitado'),
    COALESCE((p_payload->>'moradores_qtd')::int, 0),
    COALESCE((p_payload->>'gravidas')::boolean, false),
    COALESCE((p_payload->>'idosos')::boolean, false),
    COALESCE((p_payload->>'criancas_7anos')::boolean, false),
    (p_payload->>'lat_chegada')::float,
    (p_payload->>'lng_chegada')::float,
    (p_payload->>'checkin_em')::timestamptz,
    p_payload->>'observacao',
    p_payload->'payload_extra',
    COALESCE((p_payload->>'acesso_realizado')::boolean, true),
    p_payload->>'motivo_sem_acesso',
    p_payload->>'proximo_horario_sugerido',
    p_payload->>'observacao_acesso',
    p_payload->>'foto_externa_url',
    p_payload->>'origem_visita',
    p_payload->>'habitat_selecionado',
    p_payload->>'condicao_habitat',
    p_payload->>'assinatura_responsavel_url',
    COALESCE((p_payload->>'origem_offline')::boolean, false)
  ) RETURNING id INTO v_vistoria_id;

  -- 2. Depósitos
  FOR v_deposito IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'depositos', '[]'::jsonb))
  LOOP
    INSERT INTO vistoria_depositos (
      vistoria_id, tipo, qtd_inspecionados, qtd_com_agua, qtd_com_focos,
      eliminado, vedado, qtd_eliminados, usou_larvicida, qtd_larvicida_g,
      ia_identificacao
    ) VALUES (
      v_vistoria_id,
      v_deposito->>'tipo',
      COALESCE((v_deposito->>'qtd_inspecionados')::int, 0),
      COALESCE((v_deposito->>'qtd_com_agua')::int, 0),
      COALESCE((v_deposito->>'qtd_com_focos')::int, 0),
      COALESCE((v_deposito->>'eliminado')::boolean, false),
      COALESCE((v_deposito->>'vedado')::boolean, false),
      COALESCE((v_deposito->>'qtd_eliminados')::int, 0),
      COALESCE((v_deposito->>'usou_larvicida')::boolean, false),
      (v_deposito->>'qtd_larvicida_g')::float,
      v_deposito->'ia_identificacao'
    );
  END LOOP;

  -- 3. Sintomas
  IF p_payload->'sintomas' IS NOT NULL AND p_payload->>'sintomas' != 'null' THEN
    INSERT INTO vistoria_sintomas (
      vistoria_id, cliente_id, febre, manchas_vermelhas, dor_articulacoes,
      dor_cabeca, moradores_sintomas_qtd
    ) VALUES (
      v_vistoria_id,
      (p_payload->>'cliente_id')::uuid,
      COALESCE((p_payload->'sintomas'->>'febre')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'manchas_vermelhas')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'dor_articulacoes')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'dor_cabeca')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'moradores_sintomas_qtd')::int, 0)
    );
  END IF;

  -- 4. Riscos
  IF p_payload->'riscos' IS NOT NULL AND p_payload->>'riscos' != 'null' THEN
    INSERT INTO vistoria_riscos (
      vistoria_id,
      menor_incapaz, idoso_incapaz, dep_quimico, risco_alimentar, risco_moradia,
      criadouro_animais, lixo, residuos_organicos, residuos_quimicos, residuos_medicos,
      acumulo_material_organico, animais_sinais_lv, caixa_destampada, outro_risco_vetorial
    ) VALUES (
      v_vistoria_id,
      COALESCE((p_payload->'riscos'->>'menor_incapaz')::boolean, false),
      COALESCE((p_payload->'riscos'->>'idoso_incapaz')::boolean, false),
      COALESCE((p_payload->'riscos'->>'dep_quimico')::boolean, false),
      COALESCE((p_payload->'riscos'->>'risco_alimentar')::boolean, false),
      COALESCE((p_payload->'riscos'->>'risco_moradia')::boolean, false),
      COALESCE((p_payload->'riscos'->>'criadouro_animais')::boolean, false),
      COALESCE((p_payload->'riscos'->>'lixo')::boolean, false),
      COALESCE((p_payload->'riscos'->>'residuos_organicos')::boolean, false),
      COALESCE((p_payload->'riscos'->>'residuos_quimicos')::boolean, false),
      COALESCE((p_payload->'riscos'->>'residuos_medicos')::boolean, false),
      COALESCE((p_payload->'riscos'->>'acumulo_material_organico')::boolean, false),
      COALESCE((p_payload->'riscos'->>'animais_sinais_lv')::boolean, false),
      COALESCE((p_payload->'riscos'->>'caixa_destampada')::boolean, false),
      p_payload->'riscos'->>'outro_risco_vetorial'
    );
  END IF;

  -- 5. Calhas
  FOR v_calha IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'calhas', '[]'::jsonb))
  LOOP
    INSERT INTO vistoria_calhas (
      vistoria_id, posicao, condicao, com_foco, observacao
    ) VALUES (
      v_vistoria_id,
      v_calha->>'posicao',
      v_calha->>'condicao',
      COALESCE((v_calha->>'com_foco')::boolean, false),
      v_calha->>'observacao'
    );
  END LOOP;

  -- 6. Atualizar perfil do imóvel quando há calha
  IF COALESCE((p_payload->>'tem_calha')::boolean, false) THEN
    UPDATE imoveis
    SET
      tem_calha       = true,
      calha_acessivel = NOT COALESCE((p_payload->>'calha_inacessivel')::boolean, false),
      updated_at      = now()
    WHERE id = (p_payload->>'imovel_id')::uuid;
  END IF;

  RETURN v_vistoria_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_vistoria_completa(jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_vistoria_completa(jsonb) IS
  'Persiste vistoria completa de forma transacional. '
  'Aceita origem_offline=true para rastrear vistorias sincronizadas do modo offline. (QW-07)';

-- ── Correção 3: updated_by em levantamento_itens ─────────────────────────────

ALTER TABLE public.levantamento_itens
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.usuarios(id);

COMMENT ON COLUMN public.levantamento_itens.updated_by IS
  'Último usuário a alterar o item. Preenchido automaticamente pelo trigger. (QW-07)';

CREATE OR REPLACE FUNCTION public.trg_levantamento_item_set_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM public.usuarios
  WHERE auth_id = auth.uid();

  NEW.updated_at := now();
  NEW.updated_by := v_user_id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_levantamento_item_set_updated_by() IS
  'Preenche updated_by e updated_at em todo UPDATE de levantamento_itens. (QW-07)';

-- Evita duplicata em caso de re-execução da migration
DROP TRIGGER IF EXISTS trg_set_updated_by ON public.levantamento_itens;

CREATE TRIGGER trg_set_updated_by
  BEFORE UPDATE ON public.levantamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.trg_levantamento_item_set_updated_by();
