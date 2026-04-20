-- Corrige create_vistoria_completa: vistoria_depositos e vistoria_calhas exigem cliente_id (M09).
-- Reintroduz verificação de tenant removida em migrações posteriores à 20260739.

CREATE OR REPLACE FUNCTION public.create_vistoria_completa(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idempotency_key uuid;
  v_existing_id     uuid;
  v_vistoria_id     uuid;
  v_cliente_id      uuid;
  v_imovel_id       uuid;
  v_foco_risco_id   uuid;
BEGIN
  v_idempotency_key := (p_payload->>'idempotency_key')::uuid;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
      FROM vistorias
     WHERE idempotency_key = v_idempotency_key
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  v_cliente_id    := (p_payload->>'cliente_id')::uuid;
  v_imovel_id     := (p_payload->>'imovel_id')::uuid;
  v_foco_risco_id := (p_payload->>'foco_risco_id')::uuid;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'create_vistoria_completa: cliente_id obrigatório no payload';
  END IF;

  IF NOT public.usuario_pode_acessar_cliente(v_cliente_id) THEN
    RAISE EXCEPTION
      'create_vistoria_completa: acesso negado — cliente_id não pertence ao usuário autenticado';
  END IF;

  INSERT INTO vistorias (
    cliente_id, imovel_id, agente_id, ciclo, tipo_atividade, data_visita,
    status, acesso_realizado, motivo_sem_acesso, proximo_horario_sugerido,
    observacao_acesso, foto_externa_url, moradores_qtd, gravidas, idosos,
    criancas_7anos, lat_chegada, lng_chegada, checkin_em, observacao,
    origem_visita, habitat_selecionado, condicao_habitat,
    assinatura_responsavel_url, origem_offline, idempotency_key, foco_risco_id
  ) VALUES (
    v_cliente_id,
    v_imovel_id,
    (p_payload->>'agente_id')::uuid,
    (p_payload->>'ciclo')::int,
    (p_payload->>'tipo_atividade')::text,
    (p_payload->>'data_visita')::date,
    COALESCE(p_payload->>'status', 'visitado'),
    COALESCE((p_payload->>'acesso_realizado')::boolean, true),
    p_payload->>'motivo_sem_acesso',
    p_payload->>'proximo_horario_sugerido',
    p_payload->>'observacao_acesso',
    p_payload->>'foto_externa_url',
    COALESCE((p_payload->>'moradores_qtd')::int, 0),
    COALESCE((p_payload->>'gravidas')::boolean, false),
    COALESCE((p_payload->>'idosos')::boolean, false),
    COALESCE((p_payload->>'criancas_7anos')::boolean, false),
    (p_payload->>'lat_chegada')::float,
    (p_payload->>'lng_chegada')::float,
    (p_payload->>'checkin_em')::timestamptz,
    p_payload->>'observacao',
    p_payload->>'origem_visita',
    p_payload->>'habitat_selecionado',
    p_payload->>'condicao_habitat',
    p_payload->>'assinatura_responsavel_url',
    COALESCE((p_payload->>'origem_offline')::boolean, false),
    v_idempotency_key,
    v_foco_risco_id
  )
  RETURNING id INTO v_vistoria_id;

  IF p_payload ? 'depositos' AND jsonb_array_length(p_payload->'depositos') > 0 THEN
    INSERT INTO vistoria_depositos (
      vistoria_id, cliente_id, tipo, qtd_inspecionados, qtd_com_agua, qtd_com_focos,
      eliminado, vedado, qtd_eliminados, usou_larvicida, qtd_larvicida_g, ia_identificacao
    )
    SELECT
      v_vistoria_id,
      v_cliente_id,
      (d->>'tipo')::text,
      COALESCE((d->>'qtd_inspecionados')::int, 0),
      COALESCE((d->>'qtd_com_agua')::int, 0),
      COALESCE((d->>'qtd_com_focos')::int, 0),
      COALESCE((d->>'eliminado')::boolean, false),
      COALESCE((d->>'vedado')::boolean, false),
      COALESCE((d->>'qtd_eliminados')::int, 0),
      COALESCE((d->>'usou_larvicida')::boolean, false),
      (d->>'qtd_larvicida_g')::float,
      d->'ia_identificacao'
    FROM jsonb_array_elements(p_payload->'depositos') AS d
    ON CONFLICT (vistoria_id, tipo) DO UPDATE SET
      qtd_inspecionados = EXCLUDED.qtd_inspecionados,
      qtd_com_agua      = EXCLUDED.qtd_com_agua,
      qtd_com_focos     = EXCLUDED.qtd_com_focos,
      eliminado         = EXCLUDED.eliminado,
      vedado            = EXCLUDED.vedado,
      qtd_eliminados    = EXCLUDED.qtd_eliminados,
      usou_larvicida    = EXCLUDED.usou_larvicida,
      qtd_larvicida_g   = EXCLUDED.qtd_larvicida_g,
      ia_identificacao  = EXCLUDED.ia_identificacao;
  END IF;

  IF p_payload ? 'sintomas' AND p_payload->'sintomas' != 'null'::jsonb THEN
    INSERT INTO vistoria_sintomas (
      vistoria_id, cliente_id,
      febre, manchas_vermelhas, dor_articulacoes, dor_cabeca, moradores_sintomas_qtd
    ) VALUES (
      v_vistoria_id, v_cliente_id,
      COALESCE((p_payload->'sintomas'->>'febre')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'manchas_vermelhas')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'dor_articulacoes')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'dor_cabeca')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'moradores_sintomas_qtd')::int, 0)
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF p_payload ? 'riscos' AND p_payload->'riscos' != 'null'::jsonb THEN
    INSERT INTO vistoria_riscos (vistoria_id, cliente_id)
    VALUES (v_vistoria_id, v_cliente_id)
    ON CONFLICT DO NOTHING;

    UPDATE vistoria_riscos
       SET menor_incapaz             = COALESCE((p_payload->'riscos'->>'menor_incapaz')::boolean, false),
           idoso_incapaz             = COALESCE((p_payload->'riscos'->>'idoso_incapaz')::boolean, false),
           dep_quimico               = COALESCE((p_payload->'riscos'->>'dep_quimico')::boolean, false),
           risco_alimentar           = COALESCE((p_payload->'riscos'->>'risco_alimentar')::boolean, false),
           risco_moradia             = COALESCE((p_payload->'riscos'->>'risco_moradia')::boolean, false),
           criadouro_animais         = COALESCE((p_payload->'riscos'->>'criadouro_animais')::boolean, false),
           lixo                      = COALESCE((p_payload->'riscos'->>'lixo')::boolean, false),
           residuos_organicos        = COALESCE((p_payload->'riscos'->>'residuos_organicos')::boolean, false),
           residuos_quimicos         = COALESCE((p_payload->'riscos'->>'residuos_quimicos')::boolean, false),
           residuos_medicos          = COALESCE((p_payload->'riscos'->>'residuos_medicos')::boolean, false),
           acumulo_material_organico = COALESCE((p_payload->'riscos'->>'acumulo_material_organico')::boolean, false),
           animais_sinais_lv         = COALESCE((p_payload->'riscos'->>'animais_sinais_lv')::boolean, false),
           caixa_destampada          = COALESCE((p_payload->'riscos'->>'caixa_destampada')::boolean, false),
           outro_risco_vetorial      = p_payload->'riscos'->>'outro_risco_vetorial'
     WHERE vistoria_id = v_vistoria_id;
  END IF;

  IF p_payload ? 'calhas' AND jsonb_array_length(p_payload->'calhas') > 0 THEN
    INSERT INTO vistoria_calhas (vistoria_id, cliente_id, posicao, condicao, com_foco)
    SELECT
      v_vistoria_id,
      v_cliente_id,
      (c->>'posicao')::text,
      (c->>'condicao')::text,
      COALESCE((c->>'com_foco')::boolean, false)
    FROM jsonb_array_elements(p_payload->'calhas') AS c;
  END IF;

  RETURN v_vistoria_id;
END;
$$;

COMMENT ON FUNCTION public.create_vistoria_completa(jsonb) IS
  'Cria vistoria completa com depósitos, sintomas, riscos e calhas. Preenche cliente_id em filhas. Valida tenant.';

GRANT EXECUTE ON FUNCTION public.create_vistoria_completa(jsonb) TO authenticated;
