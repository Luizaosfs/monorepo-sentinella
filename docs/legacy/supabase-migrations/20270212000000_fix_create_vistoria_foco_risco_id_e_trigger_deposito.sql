-- Corrige dois problemas introduzidos pela migration 20270211000000:
--
-- 1. create_vistoria_completa perdeu foco_risco_id e idempotency_key na versão anterior.
--    Esta migration restaura-os e mantém o fix de cliente_id nos depósitos.
--
-- 2. fn_criar_foco_de_vistoria_deposito criava novos focos mesmo quando a vistoria
--    já estava vinculada a um foco existente (foco_risco_id IS NOT NULL).
--    Resultado: 3 depósitos com larvas → 3 focos fantasma duplicados.

-- ── 1. create_vistoria_completa: versão canônica com todos os campos ──────────

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

  -- 2. Depósitos — inclui cliente_id (NOT NULL) e trata conflict
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

  -- 6. Atualizar perfil do imóvel quando há calha (só quando imovel_id presente)
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

-- ── 2. fn_criar_foco_de_vistoria_deposito: não criar focos quando vistoria ─────
--    já pertence a um foco existente (foco_risco_id IS NOT NULL).
--    Evita focos duplicados quando o agente faz inspeção de um foco com larvas.

CREATE OR REPLACE FUNCTION fn_criar_foco_de_vistoria_deposito()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vis record;
  v_imo record;
BEGIN
  IF NEW.qtd_com_focos IS NULL OR NEW.qtd_com_focos = 0 THEN
    RETURN NEW;
  END IF;

  SELECT v.cliente_id, v.imovel_id, v.ciclo, v.agente_id, v.foco_risco_id
    INTO v_vis
    FROM vistorias v
   WHERE v.id = NEW.vistoria_id;

  -- Se a vistoria já pertence a um foco existente, não duplicar.
  -- O foco original será confirmado pelo fluxo de transição normal.
  IF v_vis.foco_risco_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_vis.imovel_id IS NOT NULL THEN
    SELECT i.regiao_id, i.latitude, i.longitude,
           i.logradouro || ', ' || coalesce(i.numero,'S/N') AS endereco
      INTO v_imo
      FROM imoveis i
     WHERE i.id = v_vis.imovel_id;
  END IF;

  -- Cria como 'suspeita' — o trigger trg_auto_triagem_foco avança para em_triagem
  INSERT INTO focos_risco (
    cliente_id,
    imovel_id,
    regiao_id,
    origem_tipo,
    origem_vistoria_id,
    status,
    ciclo,
    latitude,
    longitude,
    endereco_normalizado
  ) VALUES (
    v_vis.cliente_id,
    v_vis.imovel_id,
    v_imo.regiao_id,
    'agente',
    NEW.vistoria_id,
    'suspeita',
    v_vis.ciclo,
    v_imo.latitude,
    v_imo.longitude,
    v_imo.endereco
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
