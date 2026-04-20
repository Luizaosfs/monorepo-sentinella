-- Compatibilidade do Canal Cidadão com bancos sem coluna
-- levantamento_itens.status_atendimento.
--
-- Este projeto possui ambientes em estágios diferentes de migração:
-- alguns ainda possuem status_atendimento em levantamento_itens e outros não.
-- A RPC pública não pode depender dessa coluna para inserir denúncia.

CREATE OR REPLACE FUNCTION denunciar_cidadao(
  p_slug        text,
  p_bairro_id   uuid,
  p_descricao   text,
  p_latitude    double precision DEFAULT NULL,
  p_longitude   double precision DEFAULT NULL,
  p_foto_url    text            DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id  uuid;
  v_lev_id      uuid;
  v_item_id     uuid;
  v_rate_total  integer;
  v_raio_m      constant numeric := 30;
  v_janela_min  constant integer := 30;
  v_limite      constant integer := 5;
BEGIN
  SELECT id INTO v_cliente_id FROM clientes WHERE slug = p_slug AND ativo = true;
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    SELECT COALESCE(SUM(total), 0) INTO v_rate_total
    FROM canal_cidadao_rate_limit
    WHERE cliente_id = v_cliente_id
      AND ABS(latitude  - p_latitude)  < 0.0003
      AND ABS(longitude - p_longitude) < 0.0003
      AND janela_inicio > now() - (v_janela_min || ' minutes')::interval;

    IF v_rate_total >= v_limite THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Muitas denúncias registradas neste local. Aguarde ' || v_janela_min || ' minutos.'
      );
    END IF;

    INSERT INTO canal_cidadao_rate_limit (cliente_id, latitude, longitude, janela_inicio)
    VALUES (v_cliente_id, p_latitude, p_longitude, date_trunc('minute', now()))
    ON CONFLICT DO NOTHING;

    UPDATE canal_cidadao_rate_limit
    SET total = total + 1, ultima_em = now()
    WHERE cliente_id = v_cliente_id
      AND ABS(latitude  - p_latitude)  < 0.0003
      AND ABS(longitude - p_longitude) < 0.0003
      AND janela_inicio = date_trunc('minute', now());
  END IF;

  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    SELECT li.id INTO v_item_id
    FROM levantamento_itens li
    JOIN levantamentos l ON l.id = li.levantamento_id
    WHERE l.cliente_id = v_cliente_id
      AND li.item = 'Denúncia Cidadão'
      AND li.created_at > now() - interval '24 hours'
      AND li.latitude IS NOT NULL
      AND li.longitude IS NOT NULL
      AND ST_DWithin(
        ST_MakePoint(p_longitude, p_latitude)::geography,
        ST_MakePoint(li.longitude, li.latitude)::geography,
        v_raio_m
      )
    ORDER BY li.created_at DESC
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE levantamento_itens
      SET payload = jsonb_set(
        COALESCE(payload, '{}'::jsonb),
        '{confirmacoes}',
        (COALESCE((payload->>'confirmacoes')::int, 1) + 1)::text::jsonb
      )
      WHERE id = v_item_id;

      RETURN jsonb_build_object(
        'ok', true,
        'item_id', v_item_id::text,
        'deduplicado', true,
        'ja_existe', true,
        'mensagem', 'Denúncia registrada. Este local já foi reportado — sua confirmação foi contabilizada.'
      );
    END IF;
  END IF;

  SELECT id INTO v_lev_id
  FROM levantamentos
  WHERE cliente_id = v_cliente_id
    AND tipo_entrada = 'MANUAL'
    AND titulo = 'Canal Cidadão'
  LIMIT 1;

  IF v_lev_id IS NULL THEN
    INSERT INTO levantamentos (cliente_id, usuario_id, titulo, data_voo, total_itens, tipo_entrada)
    SELECT v_cliente_id, u.id, 'Canal Cidadão', CURRENT_DATE, 0, 'MANUAL'
    FROM usuarios u WHERE u.cliente_id = v_cliente_id LIMIT 1
    RETURNING id INTO v_lev_id;
  END IF;

  IF v_lev_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Não foi possível criar levantamento');
  END IF;

  -- Inserção sem depender da coluna status_atendimento (compatível com schema atual).
  INSERT INTO levantamento_itens (
    levantamento_id, item, risco, prioridade,
    latitude, longitude, endereco_curto,
    payload
  ) VALUES (
    v_lev_id, 'Denúncia Cidadão', 'Médio', 'Média',
    p_latitude, p_longitude,
    p_descricao,
    jsonb_build_object(
      'fonte',               'cidadao',
      'bairro_id',           p_bairro_id::text,
      'descricao_original',  p_descricao,
      'foto_url',            p_foto_url,
      'confirmacoes',        1
    )
  )
  RETURNING id INTO v_item_id;

  UPDATE levantamentos SET total_itens = total_itens + 1 WHERE id = v_lev_id;

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', v_item_id::text,
    'deduplicado', false,
    'ja_existe', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION consultar_denuncia_cidadao(p_protocolo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tem_status boolean;
  v_resp jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'levantamento_itens'
      AND column_name = 'status_atendimento'
  ) INTO v_tem_status;

  IF v_tem_status THEN
    SELECT jsonb_build_object(
      'ok',       true,
      'status',   li.status_atendimento,
      'data',     li.created_at::date,
      'mensagem', CASE li.status_atendimento
        WHEN 'pendente'       THEN 'Sua denúncia foi recebida e está aguardando análise.'
        WHEN 'em_atendimento' THEN 'A equipe municipal está atendendo este local.'
        WHEN 'resolvido'      THEN 'Atendimento concluído. Obrigado pela sua colaboração!'
        ELSE 'Status: ' || li.status_atendimento
      END
    )
    INTO v_resp
    FROM levantamento_itens li
    WHERE starts_with(li.id::text, lower(p_protocolo))
      AND li.item = 'Denúncia Cidadão'
    LIMIT 1;
  ELSE
    SELECT jsonb_build_object(
      'ok',       true,
      'status',   'pendente',
      'data',     li.created_at::date,
      'mensagem', 'Sua denúncia foi recebida e está aguardando análise.'
    )
    INTO v_resp
    FROM levantamento_itens li
    WHERE starts_with(li.id::text, lower(p_protocolo))
      AND li.item = 'Denúncia Cidadão'
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_resp, jsonb_build_object('ok', false, 'error', 'Protocolo não encontrado'));
END;
$$;

GRANT EXECUTE ON FUNCTION denunciar_cidadao(text, uuid, text, double precision, double precision, text)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION consultar_denuncia_cidadao(text)
  TO anon, authenticated;
