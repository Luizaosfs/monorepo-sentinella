-- Corrige null value in column "cliente_id" of relation "vistoria_riscos"
-- O INSERT em vistoria_riscos dentro de create_vistoria_completa esquecia de
-- passar cliente_id, que é NOT NULL. A variável v_cliente_id existia mas não
-- era usada naquele bloco.

CREATE OR REPLACE FUNCTION create_vistoria_completa(p_payload jsonb)
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
  v_deposito        jsonb;
  v_calha           jsonb;
BEGIN
  -- Idempotência: se já existe vistoria com essa key, retorna sem duplicar
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

  -- 1. Vistoria principal
  INSERT INTO vistorias (
    cliente_id, imovel_id, agente_id, ciclo, tipo_atividade, data_visita,
    status, acesso_realizado, motivo_sem_acesso, proximo_horario_sugerido,
    observacao_acesso, foto_externa_url, moradores_qtd, gravidas, idosos,
    criancas_7anos, lat_chegada, lng_chegada, checkin_em, observacao,
    origem_visita, habitat_selecionado, condicao_habitat,
    assinatura_responsavel_url, idempotency_key, foco_risco_id
  ) VALUES (
    v_cliente_id,
    v_imovel_id,
    (p_payload->>'agente_id')::uuid,
    (p_payload->>'ciclo')::int,
    p_payload->>'tipo_atividade',
    COALESCE((p_payload->>'data_visita')::timestamptz, now()),
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
    v_idempotency_key,
    v_foco_risco_id
  ) RETURNING id INTO v_vistoria_id;

  -- 2. Depósitos
  FOR v_deposito IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'depositos', '[]'::jsonb))
  LOOP
    INSERT INTO vistoria_depositos (
      vistoria_id, cliente_id, tipo,
      qtd_inspecionados, qtd_com_agua, qtd_com_focos,
      eliminado, vedado, qtd_eliminados, usou_larvicida, qtd_larvicida_g,
      ia_identificacao
    ) VALUES (
      v_vistoria_id,
      v_cliente_id,
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
    )
    ON CONFLICT (vistoria_id, tipo) DO UPDATE SET
      qtd_inspecionados = EXCLUDED.qtd_inspecionados,
      qtd_com_agua      = EXCLUDED.qtd_com_agua,
      qtd_com_focos     = EXCLUDED.qtd_com_focos,
      eliminado         = EXCLUDED.eliminado,
      vedado            = EXCLUDED.vedado,
      qtd_eliminados    = EXCLUDED.qtd_eliminados,
      usou_larvicida    = EXCLUDED.usou_larvicida,
      qtd_larvicida_g   = EXCLUDED.qtd_larvicida_g;
  END LOOP;

  -- 3. Sintomas
  IF p_payload->'sintomas' IS NOT NULL AND p_payload->>'sintomas' != 'null' THEN
    INSERT INTO vistoria_sintomas (
      vistoria_id, cliente_id, febre, manchas_vermelhas, dor_articulacoes,
      dor_cabeca, moradores_sintomas_qtd
    ) VALUES (
      v_vistoria_id, v_cliente_id,
      COALESCE((p_payload->'sintomas'->>'febre')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'manchas_vermelhas')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'dor_articulacoes')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'dor_cabeca')::boolean, false),
      COALESCE((p_payload->'sintomas'->>'moradores_sintomas_qtd')::int, 0)
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 4. Riscos — FIX: cliente_id incluído (estava ausente na migration anterior)
  IF p_payload->'riscos' IS NOT NULL AND p_payload->>'riscos' != 'null' THEN
    INSERT INTO vistoria_riscos (
      vistoria_id, cliente_id,
      menor_incapaz, idoso_incapaz, dep_quimico, risco_alimentar, risco_moradia,
      criadouro_animais, lixo, residuos_organicos, residuos_quimicos, residuos_medicos,
      acumulo_material_organico, animais_sinais_lv, caixa_destampada, outro_risco_vetorial
    ) VALUES (
      v_vistoria_id, v_cliente_id,
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
  IF COALESCE((p_payload->>'tem_calha')::boolean, false)
     AND v_imovel_id IS NOT NULL THEN
    UPDATE imoveis
    SET
      tem_calha       = true,
      calha_acessivel = NOT COALESCE((p_payload->>'calha_inacessivel')::boolean, false),
      updated_at      = now()
    WHERE id = v_imovel_id;
  END IF;

  RETURN v_vistoria_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_vistoria_completa(jsonb) TO authenticated;
