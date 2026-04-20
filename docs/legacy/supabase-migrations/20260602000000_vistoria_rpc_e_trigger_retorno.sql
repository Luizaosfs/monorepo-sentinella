-- ============================================================
-- F-01: RPC create_vistoria_completa — persistência transacional
-- ============================================================
CREATE OR REPLACE FUNCTION create_vistoria_completa(p_payload jsonb)
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
    origem_visita, habitat_selecionado, condicao_habitat
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
    p_payload->>'condicao_habitat'
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

GRANT EXECUTE ON FUNCTION create_vistoria_completa(jsonb) TO authenticated;

-- ============================================================
-- F-03: Trigger automático de alerta de retorno
-- Substitui a chamada best-effort no cliente
-- ============================================================
CREATE OR REPLACE FUNCTION fn_criar_alerta_retorno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retorno_em timestamptz;
BEGIN
  -- Calcular prazo de retorno baseado no horário sugerido
  v_retorno_em := CASE NEW.proximo_horario_sugerido
    WHEN 'manha'         THEN date_trunc('day', now()) + interval '1 day' + interval '8 hours'
    WHEN 'tarde'         THEN date_trunc('day', now()) + interval '1 day' + interval '14 hours'
    WHEN 'fim_de_semana' THEN date_trunc('week', now()) + interval '5 days' + interval '9 hours'
    ELSE                      now() + interval '24 hours'
  END;

  INSERT INTO alerta_retorno_imovel (
    cliente_id, imovel_id, agente_id, vistoria_id, ciclo, motivo, retorno_em, resolvido
  ) VALUES (
    NEW.cliente_id,
    NEW.imovel_id,
    NEW.agente_id,
    NEW.id,
    NEW.ciclo,
    NEW.motivo_sem_acesso,
    v_retorno_em,
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_alerta_retorno ON vistorias;
CREATE TRIGGER trg_criar_alerta_retorno
  AFTER INSERT ON vistorias
  FOR EACH ROW
  WHEN (NEW.acesso_realizado = false)
  EXECUTE FUNCTION fn_criar_alerta_retorno();

-- ============================================================
-- F-02: Validação de resolução de itens críticos/altos no banco
-- Garante que itens de alta criticidade exigem ação registrada
-- ============================================================
CREATE OR REPLACE FUNCTION fn_validar_resolucao_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Aplica somente na transição para 'resolvido'
  IF NEW.status_atendimento = 'resolvido'
     AND (OLD.status_atendimento IS DISTINCT FROM 'resolvido') THEN

    -- Itens críticos e altos exigem ação registrada com ao menos 10 caracteres
    IF (NEW.risco IN ('Crítico', 'critico', 'Alto', 'alto'))
       AND (NEW.acao_aplicada IS NULL OR char_length(trim(NEW.acao_aplicada)) < 10) THEN
      RAISE EXCEPTION
        'item_resolucao_sem_acao: itens de risco Crítico ou Alto exigem descrição da ação com mínimo 10 caracteres (id=%).', NEW.id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_resolucao_item ON levantamento_itens;
CREATE TRIGGER trg_validar_resolucao_item
  BEFORE UPDATE ON levantamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION fn_validar_resolucao_item();
