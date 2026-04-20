-- P2: Idempotency key para sync offline
-- Garante que reenvios de vistorias offline não criem duplicatas.
-- A coluna idempotency_key é gerada no frontend (crypto.randomUUID()) antes de enfileirar
-- e enviada no payload da RPC create_vistoria_completa.
-- O UNIQUE constraint faz a RPC retornar o id da vistoria existente em caso de conflito.

-- ── vistorias ──────────────────────────────────────────────────────────────────

ALTER TABLE vistorias
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

-- Índice UNIQUE parcial: aplica somente a registros com key definida (retrocompatível)
CREATE UNIQUE INDEX IF NOT EXISTS uq_vistorias_idempotency_key
  ON vistorias (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── create_vistoria_completa: suporte a idempotency_key ───────────────────────
-- Atualiza a RPC para extrair e persistir idempotency_key do payload.
-- Se já existir uma vistoria com a mesma key, retorna o id existente sem erro.

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
BEGIN
  -- Extrair idempotency_key se presente
  v_idempotency_key := (p_payload->>'idempotency_key')::uuid;

  -- Verificar se já existe vistoria com essa key (retry idempotente)
  IF v_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
      FROM vistorias
     WHERE idempotency_key = v_idempotency_key
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id; -- idempotente: retorna id existente
    END IF;
  END IF;

  v_cliente_id := (p_payload->>'cliente_id')::uuid;
  v_imovel_id  := (p_payload->>'imovel_id')::uuid;

  -- Inserir vistoria principal
  INSERT INTO vistorias (
    cliente_id, imovel_id, agente_id, ciclo, tipo_atividade, data_visita,
    status, acesso_realizado, motivo_sem_acesso, proximo_horario_sugerido,
    observacao_acesso, foto_externa_url, moradores_qtd, gravidas, idosos,
    criancas_7anos, lat_chegada, lng_chegada, checkin_em, observacao,
    origem_visita, habitat_selecionado, condicao_habitat,
    assinatura_responsavel_url, origem_offline, idempotency_key
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
    v_idempotency_key
  )
  RETURNING id INTO v_vistoria_id;

  -- Inserir depósitos
  IF p_payload ? 'depositos' AND jsonb_array_length(p_payload->'depositos') > 0 THEN
    INSERT INTO vistoria_depositos (
      vistoria_id, tipo, qtd_inspecionados, qtd_com_agua, qtd_com_focos,
      eliminado, vedado, qtd_eliminados, usou_larvicida, qtd_larvicida_g, ia_identificacao
    )
    SELECT
      v_vistoria_id,
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
      qtd_larvicida_g   = EXCLUDED.qtd_larvicida_g;
  END IF;

  -- Inserir sintomas
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

  -- Inserir riscos
  IF p_payload ? 'riscos' AND p_payload->'riscos' != 'null'::jsonb THEN
    INSERT INTO vistoria_riscos (vistoria_id, cliente_id)
    VALUES (v_vistoria_id, v_cliente_id)
    ON CONFLICT DO NOTHING;

    UPDATE vistoria_riscos
       SET menor_incapaz        = COALESCE((p_payload->'riscos'->>'menor_incapaz')::boolean, false),
           idoso_incapaz        = COALESCE((p_payload->'riscos'->>'idoso_incapaz')::boolean, false),
           dep_quimico          = COALESCE((p_payload->'riscos'->>'dep_quimico')::boolean, false),
           risco_alimentar      = COALESCE((p_payload->'riscos'->>'risco_alimentar')::boolean, false),
           risco_moradia        = COALESCE((p_payload->'riscos'->>'risco_moradia')::boolean, false),
           criadouro_animais    = COALESCE((p_payload->'riscos'->>'criadouro_animais')::boolean, false),
           lixo                 = COALESCE((p_payload->'riscos'->>'lixo')::boolean, false),
           residuos_organicos   = COALESCE((p_payload->'riscos'->>'residuos_organicos')::boolean, false),
           residuos_quimicos    = COALESCE((p_payload->'riscos'->>'residuos_quimicos')::boolean, false),
           residuos_medicos     = COALESCE((p_payload->'riscos'->>'residuos_medicos')::boolean, false),
           acumulo_material_organico = COALESCE((p_payload->'riscos'->>'acumulo_material_organico')::boolean, false),
           animais_sinais_lv    = COALESCE((p_payload->'riscos'->>'animais_sinais_lv')::boolean, false),
           caixa_destampada     = COALESCE((p_payload->'riscos'->>'caixa_destampada')::boolean, false),
           outro_risco_vetorial = p_payload->'riscos'->>'outro_risco_vetorial'
     WHERE vistoria_id = v_vistoria_id;
  END IF;

  -- Inserir calhas
  IF p_payload ? 'calhas' AND jsonb_array_length(p_payload->'calhas') > 0 THEN
    INSERT INTO vistoria_calhas (vistoria_id, posicao, condicao, com_foco)
    SELECT
      v_vistoria_id,
      (c->>'posicao')::text,
      (c->>'condicao')::text,
      COALESCE((c->>'com_foco')::boolean, false)
    FROM jsonb_array_elements(p_payload->'calhas') AS c;
  END IF;

  RETURN v_vistoria_id;
END;
$$;

-- Garantir que a função é acessível por usuários autenticados via RLS
GRANT EXECUTE ON FUNCTION create_vistoria_completa(jsonb) TO authenticated;
