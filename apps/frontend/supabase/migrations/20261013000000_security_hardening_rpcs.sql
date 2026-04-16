-- =============================================================================
-- SECURITY HARDENING — RPCs públicas e create_vistoria_completa
--
-- Vulnerabilidades corrigidas:
--   H1: consultar_denuncia_cidadao — sem validação de comprimento mínimo
--       starts_with com 1 char expõe múltiplos focos (enumeração de protocolo)
--   H2: denunciar_cidadao — p_descricao NULL aceito silenciosamente;
--       bucket 'unknown' compartilhado quando header ausente pode bloquear
--       usuários legítimos sem IP rastreável
--   H3: create_vistoria_completa — agente_id extraído do payload sem
--       validação contra auth.uid(): qualquer usuário autenticado pode
--       submeter vistorias como outro agente (impersonation)
-- =============================================================================

-- =============================================================================
-- H1 + H2: consultar_denuncia_cidadao — enforce mínimo 8 chars
-- =============================================================================
CREATE OR REPLACE FUNCTION public.consultar_denuncia_cidadao(p_protocolo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proto text;
BEGIN
  v_proto := lower(trim(COALESCE(p_protocolo, '')));

  -- Mínimo de 8 caracteres — protocolo gerado pelo sistema tem exatamente 8.
  -- Aceitar entre 8 e 36 (UUID completo) para permitir buscas com UUID inteiro.
  IF length(v_proto) < 8 THEN
    RETURN jsonb_build_object(
      'ok',    false,
      'error', 'Protocolo inválido. Informe os 8 caracteres do protocolo de atendimento.'
    );
  END IF;

  -- Truncar para os 36 chars máximos de um UUID; qualquer entrada maior é inválida.
  IF length(v_proto) > 36 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Protocolo inválido.');
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_build_object(
        'ok',       true,
        'foco_id',  fr.id::text,
        'status',   fr.status,
        'data',     fr.created_at::date,
        'mensagem', CASE fr.status
          WHEN 'suspeita'         THEN 'Sua denúncia foi recebida e está sendo analisada.'
          WHEN 'em_triagem'       THEN 'Sua denúncia está em triagem pela equipe técnica.'
          WHEN 'aguarda_inspecao' THEN 'A equipe irá ao local em breve para inspeção.'
          WHEN 'em_inspecao'      THEN 'A equipe está inspecionando o local.'
          WHEN 'confirmado'       THEN 'O foco foi confirmado e está em fila de atendimento.'
          WHEN 'em_tratamento'    THEN 'A equipe municipal está realizando o tratamento no local.'
          WHEN 'resolvido'        THEN 'O foco foi resolvido. Obrigado pela sua denúncia!'
          WHEN 'descartado'       THEN 'Após análise, o local foi considerado sem risco no momento.'
          ELSE                         'Status em processamento.'
        END
      )
      FROM public.focos_risco fr
      WHERE starts_with(fr.id::text, v_proto)
        AND fr.origem_tipo = 'cidadao'
        AND fr.deleted_at  IS NULL
      LIMIT 1
    ),
    jsonb_build_object('ok', false, 'error', 'Protocolo não encontrado.')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consultar_denuncia_cidadao(text) TO anon, authenticated;

COMMENT ON FUNCTION public.consultar_denuncia_cidadao(text) IS
  'Consulta pública de protocolo. Exige mínimo 8 chars (impede enumeração em massa). '
  'Aceita 8–36 chars. Corrigido em 20261001000000 (H1).';

-- =============================================================================
-- H2: denunciar_cidadao — validação de p_descricao + IP 'unknown' isolado
-- =============================================================================
DROP FUNCTION IF EXISTS public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text);

CREATE FUNCTION public.denunciar_cidadao(
  p_slug            text,
  p_bairro_id       uuid             DEFAULT NULL,
  p_descricao       text             DEFAULT NULL,
  p_latitude        double precision DEFAULT NULL,
  p_longitude       double precision DEFAULT NULL,
  p_foto_url        text             DEFAULT NULL,
  p_foto_public_id  text             DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id  uuid;
  v_regiao_id   uuid;
  v_foco_id     uuid;
  v_foco_existe uuid;
  v_ciclo       int;
  -- rate limit
  v_ip_raw      text;
  v_ip_hash     text;
  v_janela      timestamptz;
  v_contagem    int;
  v_limite      int  := 5;
  v_janela_min  int  := 30;
  -- dedup
  v_raio_m      int  := 30;
BEGIN
  -- 1. Validar p_descricao antes de qualquer acesso ao banco
  IF p_descricao IS NULL OR trim(p_descricao) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Descrição é obrigatória.');
  END IF;

  -- 2. Resolver cliente pelo slug
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE slug = p_slug AND ativo = true;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  -- 3. Rate limit por IP (janela de 30 minutos)
  --    Quando o header está ausente (IP desconhecido), usa sufixo '_unknown'
  --    para NÃO criar um único bucket compartilhado que bloquearia todos os
  --    usuários sem IP rastreável ao mesmo tempo.
  BEGIN
    v_ip_raw := split_part(
      current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
      ',', 1
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip_raw := NULL;
  END;

  v_ip_raw  := COALESCE(nullif(trim(v_ip_raw), ''), NULL);
  v_ip_hash := md5(
    COALESCE(v_ip_raw, 'unknown_' || gen_random_uuid()::text)
    || v_cliente_id::text
  );

  -- Pular rate-limit quando IP genuinamente desconhecido (hash aleatório por request)
  IF v_ip_raw IS NOT NULL THEN
    v_janela := date_trunc('hour', now())
                 + INTERVAL '30 minutes'
                 * FLOOR(EXTRACT(minute FROM now()) / 30);

    INSERT INTO public.canal_cidadao_rate_limit (ip_hash, cliente_id, janela_hora, contagem)
    VALUES (v_ip_hash, v_cliente_id, v_janela, 1)
    ON CONFLICT (ip_hash, cliente_id, janela_hora)
    DO UPDATE SET contagem = canal_cidadao_rate_limit.contagem + 1
    RETURNING contagem INTO v_contagem;

    IF v_contagem > v_limite THEN
      UPDATE public.canal_cidadao_rate_limit
      SET contagem = v_limite
      WHERE ip_hash = v_ip_hash AND cliente_id = v_cliente_id AND janela_hora = v_janela;

      RETURN jsonb_build_object(
        'ok',    false,
        'error', 'Muitas denúncias registradas neste local. Aguarde ' || v_janela_min || ' minutos.'
      );
    END IF;
  END IF;

  -- 4. Deduplicação geoespacial: foco cidadão próximo (30m) nas últimas 24h
  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    SELECT id INTO v_foco_existe
    FROM public.focos_risco
    WHERE cliente_id    = v_cliente_id
      AND origem_tipo   = 'cidadao'
      AND status        NOT IN ('descartado')
      AND deleted_at    IS NULL
      AND created_at    > now() - INTERVAL '24 hours'
      AND ST_DWithin(
            ST_MakePoint(longitude, latitude)::geography,
            ST_MakePoint(p_longitude, p_latitude)::geography,
            v_raio_m
          )
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_foco_existe IS NOT NULL THEN
      UPDATE public.focos_risco
      SET payload = jsonb_set(
            COALESCE(payload, '{}'::jsonb),
            '{confirmacoes}',
            to_jsonb(COALESCE((payload->>'confirmacoes')::int, 1) + 1)
          )
      WHERE id = v_foco_existe;

      RETURN jsonb_build_object(
        'ok',         true,
        'foco_id',    v_foco_existe::text,
        'deduplicado', true
      );
    END IF;
  END IF;

  -- 5. Resolver região pelo bairro_id (opcional)
  IF p_bairro_id IS NOT NULL THEN
    SELECT id INTO v_regiao_id
    FROM public.regioes
    WHERE id = p_bairro_id AND cliente_id = v_cliente_id;
  END IF;

  -- 6. Ciclo atual (1–6 por ano, 2 meses cada)
  v_ciclo := CEIL(EXTRACT(MONTH FROM now())::int / 2.0)::int;

  -- 7. Criar foco_risco
  INSERT INTO public.focos_risco (
    cliente_id, regiao_id, origem_tipo, status, prioridade,
    ciclo, latitude, longitude, endereco_normalizado, suspeita_em, payload
  ) VALUES (
    v_cliente_id,
    v_regiao_id,
    'cidadao',
    'suspeita',
    'P3',
    v_ciclo,
    p_latitude,
    p_longitude,
    LEFT(trim(p_descricao), 500),
    now(),
    jsonb_build_object(
      'fonte',              'cidadao',
      'bairro_id',          p_bairro_id::text,
      'descricao_original', p_descricao,
      'foto_url',           p_foto_url,
      'foto_public_id',     p_foto_public_id,
      'confirmacoes',       1
    )
  )
  RETURNING id INTO v_foco_id;

  RETURN jsonb_build_object(
    'ok',          true,
    'foco_id',     v_foco_id::text,
    'deduplicado', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text)
  TO anon, authenticated;

COMMENT ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text) IS
  'Canal cidadão. Corrigido em 20261001000000 (H2): '
  '1) p_descricao obrigatório — retorna erro se NULL ou vazio. '
  '2) IP desconhecido (header ausente) usa hash aleatório por request, evitando bucket compartilhado. '
  '3) Rate limit só aplica quando IP é rastreável.';

-- =============================================================================
-- H3: create_vistoria_completa — validar agente_id contra auth.uid()
--
-- Papéis reais do sistema:
--   'admin'      = dono do SaaS — nível máximo, bypass irrestrito
--   'supervisor' = gestor da prefeitura — pode submeter por operador do mesmo cliente
--   'operador'   = agente de campo — só submete para si mesmo
--   'notificador'= UBS/posto de saúde — não acessa vistorias
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_vistoria_completa(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vistoria_id     uuid;
  v_deposito        jsonb;
  v_calha           jsonb;
  v_caller_user_id  uuid;
  v_caller_cliente  uuid;
  v_payload_agente  uuid;
  v_payload_cliente uuid;
  v_caller_papel    text;
BEGIN
  -- H3: agente_id do payload deve ser o próprio usuário autenticado,
  --     exceto admin (bypass total) ou supervisor do mesmo cliente.
  SELECT id, cliente_id
    INTO v_caller_user_id, v_caller_cliente
    FROM public.usuarios
   WHERE auth_id = auth.uid()
   LIMIT 1;

  v_payload_agente  := (p_payload->>'agente_id')::uuid;
  v_payload_cliente := (p_payload->>'cliente_id')::uuid;

  IF v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado para auth.uid = %', auth.uid();
  END IF;

  IF v_payload_agente IS DISTINCT FROM v_caller_user_id THEN
    SELECT LOWER(papel::text) INTO v_caller_papel
    FROM public.papeis_usuarios
    WHERE usuario_id = v_caller_user_id
    ORDER BY CASE LOWER(papel::text)
      WHEN 'admin'      THEN 4
      WHEN 'supervisor' THEN 3
      WHEN 'operador'   THEN 2
      ELSE 1
    END DESC
    LIMIT 1;

    IF v_caller_papel = 'admin' THEN
      NULL; -- SaaS owner: bypass irrestrito
    ELSIF v_caller_papel = 'supervisor'
      AND v_caller_cliente = v_payload_cliente THEN
      NULL; -- supervisor da mesma prefeitura: permitido
    ELSE
      RAISE EXCEPTION
        'Não autorizado: somente supervisor da mesma prefeitura pode registrar '
        'vistoria por outro operador. caller=%, payload_agente=%',
        v_caller_user_id, v_payload_agente;
    END IF;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.create_vistoria_completa(jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_vistoria_completa(jsonb) IS
  'RPC transacional para salvar vistoria completa. '
  'Corrigido em 20261001000000 (H3): agente_id do payload validado contra auth.uid(); '
  'apenas admin/gestor pode submeter vistoria com agente_id de terceiro.';
