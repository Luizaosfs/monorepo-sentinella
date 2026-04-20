-- =============================================================================
-- 1C: Corrigir denunciar_cidadao e consultar_denuncia_cidadao
--
-- Problema: INSERT em levantamento_itens ainda inclui status_atendimento
-- (coluna removida em 20260711000000). Duas versões afetadas:
--   - 5 params (20260728000000_qw14a_rate_limit_canal_cidadao.sql)
--   - 6 params com p_foto_url (20260410000000_canal_cidadao_melhorias.sql)
-- consultar_denuncia_cidadao referencia li.status_atendimento — quebrado.
--
-- Fix: remover status_atendimento dos INSERTs; reescrever consulta para
-- usar focos_risco.status com mapeamento para linguagem do cidadão.
-- =============================================================================

-- ── 1. Corrigir versão 5-params (v20260728 — rate limit por IP hash) ─────────

CREATE OR REPLACE FUNCTION denunciar_cidadao(
  p_slug        text,
  p_bairro_id   uuid,
  p_descricao   text,
  p_latitude    double precision DEFAULT NULL,
  p_longitude   double precision DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id  uuid;
  v_lev_id      uuid;
  v_item_id     uuid;
  v_ip_raw      text;
  v_ip_hash     text;
  v_contagem    int;
  v_janela      timestamptz;
  c_limite      CONSTANT int := 10;
BEGIN
  -- ── Rate limit por IP ──────────────────────────────────────────────────────
  BEGIN
    v_ip_raw := split_part(
      (current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'),
      ',', 1
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip_raw := 'unknown';
  END;

  v_ip_hash := md5(COALESCE(nullif(trim(v_ip_raw), ''), 'unknown'));
  v_janela  := date_trunc('hour', now());

  SELECT id INTO v_cliente_id FROM clientes WHERE slug = p_slug AND ativo = true;
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  INSERT INTO canal_cidadao_rate_limit (ip_hash, cliente_id, janela_hora, contagem)
  VALUES (v_ip_hash, v_cliente_id, v_janela, 1)
  ON CONFLICT (ip_hash, cliente_id, janela_hora)
  DO UPDATE SET contagem = canal_cidadao_rate_limit.contagem + 1
  RETURNING contagem INTO v_contagem;

  IF v_contagem > c_limite THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Muitas denúncias em pouco tempo. Tente novamente mais tarde.'
    );
  END IF;

  -- ── Busca ou cria levantamento do canal cidadão ────────────────────────────
  SELECT id INTO v_lev_id
  FROM levantamentos
  WHERE cliente_id = v_cliente_id AND tipo_entrada = 'MANUAL'
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

  -- FIX: removido status_atendimento (coluna dropada em 20260711000000)
  INSERT INTO levantamento_itens (
    levantamento_id, item, risco, prioridade,
    latitude, longitude,
    endereco_curto,
    payload
  ) VALUES (
    v_lev_id, 'Denúncia Cidadão', 'Médio', 'Média',
    p_latitude, p_longitude,
    p_descricao,
    jsonb_build_object(
      'fonte',              'cidadao',
      'bairro_id',          p_bairro_id::text,
      'descricao_original', p_descricao
    )
  )
  RETURNING id INTO v_item_id;

  UPDATE levantamentos SET total_itens = total_itens + 1 WHERE id = v_lev_id;

  RETURN jsonb_build_object('ok', true, 'item_id', v_item_id::text);
END;
$$;

GRANT EXECUTE ON FUNCTION denunciar_cidadao(text, uuid, text, double precision, double precision) TO anon;

-- ── 2. Corrigir versão 6-params com p_foto_url (v20260410) ───────────────────

CREATE OR REPLACE FUNCTION denunciar_cidadao(
  p_slug        text,
  p_bairro_id   uuid,
  p_descricao   text,
  p_latitude    double precision DEFAULT NULL,
  p_longitude   double precision DEFAULT NULL,
  p_foto_url    text             DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id  uuid;
  v_lev_id      uuid;
  v_item_id     uuid;
  v_rate_total  integer;
  v_raio_m      CONSTANT numeric  := 30;
  v_janela_min  CONSTANT integer  := 30;
  v_limite      CONSTANT integer  := 5;
BEGIN
  SELECT id INTO v_cliente_id FROM clientes WHERE slug = p_slug AND ativo = true;
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  -- Rate limit por coordenada (janela 30 min)
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

    -- Deduplicação: item idêntico no raio de 30m nas últimas 24h
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
        'mensagem', 'Denúncia registrada. Este local já foi reportado — sua confirmação foi contabilizada.'
      );
    END IF;
  END IF;

  SELECT id INTO v_lev_id
  FROM levantamentos
  WHERE cliente_id = v_cliente_id AND tipo_entrada = 'MANUAL' AND titulo = 'Canal Cidadão'
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

  -- FIX: removido status_atendimento (coluna dropada em 20260711000000)
  INSERT INTO levantamento_itens (
    levantamento_id, item, risco, prioridade,
    latitude, longitude, endereco_curto,
    payload
  ) VALUES (
    v_lev_id, 'Denúncia Cidadão', 'Médio', 'Média',
    p_latitude, p_longitude,
    p_descricao,
    jsonb_build_object(
      'fonte',              'cidadao',
      'bairro_id',          p_bairro_id::text,
      'descricao_original', p_descricao,
      'foto_url',           p_foto_url,
      'confirmacoes',       1
    )
  )
  RETURNING id INTO v_item_id;

  UPDATE levantamentos SET total_itens = total_itens + 1 WHERE id = v_lev_id;

  RETURN jsonb_build_object('ok', true, 'item_id', v_item_id::text, 'deduplicado', false);
END;
$$;

GRANT EXECUTE ON FUNCTION denunciar_cidadao(text, uuid, text, double precision, double precision, text) TO anon;

-- ── 3. Corrigir consultar_denuncia_cidadao ────────────────────────────────────
-- Problema: referenciava li.status_atendimento (coluna removida).
-- Fix: LEFT JOIN com focos_risco para obter o status atual do foco.

CREATE OR REPLACE FUNCTION consultar_denuncia_cidadao(p_protocolo text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ok',       true,
    'status',   COALESCE(fr.status, 'suspeita'),
    'data',     li.created_at::date,
    'mensagem', CASE COALESCE(fr.status, 'suspeita')
      WHEN 'suspeita'         THEN 'Sua denúncia foi recebida e está aguardando análise.'
      WHEN 'em_triagem'       THEN 'A denúncia está sendo analisada pela equipe municipal.'
      WHEN 'aguarda_inspecao' THEN 'Aguardando inspeção no local.'
      WHEN 'confirmado'       THEN 'Foco confirmado. A equipe municipal está atuando.'
      WHEN 'em_tratamento'    THEN 'A equipe municipal está atendendo este local.'
      WHEN 'resolvido'        THEN 'Atendimento concluído. Obrigado pela sua colaboração!'
      WHEN 'descartado'       THEN 'Denúncia analisada. Não foi identificado foco de risco neste local.'
      ELSE                         'Sua denúncia foi recebida e está sendo processada.'
    END
  )
  FROM levantamento_itens li
  LEFT JOIN focos_risco fr ON fr.origem_levantamento_item_id = li.id
  WHERE starts_with(li.id::text, lower(p_protocolo))
    AND li.item = 'Denúncia Cidadão'
  ORDER BY fr.created_at DESC  -- se houver múltiplos focos, pega o mais recente
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION consultar_denuncia_cidadao(text) TO anon;

COMMENT ON FUNCTION consultar_denuncia_cidadao(text) IS
  'Consulta pública de denúncia por protocolo (primeiros 8 chars do UUID). '
  'Fix 1C: usa focos_risco.status em vez de levantamento_itens.status_atendimento (coluna removida em 20260711).';
