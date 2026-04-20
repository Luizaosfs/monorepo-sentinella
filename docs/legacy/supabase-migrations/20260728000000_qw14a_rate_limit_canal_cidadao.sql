-- QW-14 Sprint A2 — Rate limit no canal cidadão
-- Proteção contra spam e abuso da função pública denunciar_cidadao.
-- Limite: 10 denúncias por IP (hash MD5) por hora por cliente.

-- ─── Tabela de rate limit ────────────────────────────────────────────────────
-- Recria a tabela para garantir schema correto (tabela é efêmera, sem dados críticos)

DROP TABLE IF EXISTS canal_cidadao_rate_limit CASCADE;

CREATE TABLE canal_cidadao_rate_limit (
  ip_hash     text        NOT NULL,
  cliente_id  uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  janela_hora timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  contagem    int         NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_hash, cliente_id, janela_hora)
);

-- Índice para limpeza periódica de registros antigos
CREATE INDEX idx_rate_limit_janela
  ON canal_cidadao_rate_limit (janela_hora);

-- RLS: tabela interna — nenhum acesso externo
ALTER TABLE canal_cidadao_rate_limit ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role e SECURITY DEFINER podem escrever

-- ─── Função de purga (chamada pelo limpeza-retencao-logs existente) ───────────

CREATE OR REPLACE FUNCTION purgar_rate_limit_canal_cidadao()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM canal_cidadao_rate_limit
  WHERE janela_hora < now() - interval '24 hours';
$$;

-- ─── RPC denunciar_cidadao com rate limit ─────────────────────────────────────
-- Extrai IP do header x-forwarded-for injetado pelo PostgREST,
-- faz hash MD5 para privacidade e verifica limite de 10/hora/cliente.

CREATE OR REPLACE FUNCTION denunciar_cidadao(
  p_slug        text,
  p_bairro_id   uuid,
  p_descricao   text,
  p_latitude    double precision DEFAULT NULL,
  p_longitude   double precision DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cliente_id  uuid;
  v_lev_id      uuid;
  v_item_id     uuid;
  v_ip_raw      text;
  v_ip_hash     text;
  v_contagem    int;
  v_janela      timestamptz;
  c_limite      constant int := 10;
BEGIN
  -- ── Rate limit por IP ──────────────────────────────────────────────────────
  -- Extrai IP do header x-forwarded-for (disponível via PostgREST)
  BEGIN
    v_ip_raw := split_part(
      (current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'),
      ',', 1
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip_raw := 'unknown';
  END;

  v_ip_hash := md5(coalesce(nullif(trim(v_ip_raw), ''), 'unknown'));
  v_janela  := date_trunc('hour', now());

  -- Resolve cliente pelo slug (necessário para chave composta do rate limit)
  SELECT id INTO v_cliente_id FROM clientes WHERE slug = p_slug AND ativo = true;
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  -- Upsert do contador
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

  -- ── Lógica original ────────────────────────────────────────────────────────

  -- Busca ou cria levantamento do canal cidadão
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

  -- Insere item
  INSERT INTO levantamento_itens (
    levantamento_id, item, risco, prioridade,
    latitude, longitude,
    endereco_curto,
    payload, status_atendimento
  ) VALUES (
    v_lev_id, 'Denúncia Cidadão', 'Médio', 'Média',
    p_latitude, p_longitude,
    p_descricao,
    jsonb_build_object(
      'fonte', 'cidadao',
      'bairro_id', p_bairro_id::text,
      'descricao_original', p_descricao
    ),
    'pendente'
  )
  RETURNING id INTO v_item_id;

  -- Atualiza contador
  UPDATE levantamentos SET total_itens = total_itens + 1 WHERE id = v_lev_id;

  RETURN jsonb_build_object('ok', true, 'item_id', v_item_id::text);
END;
$$;

-- Grant mantido para usuários anônimos (canal público)
GRANT EXECUTE ON FUNCTION denunciar_cidadao(text, uuid, text, double precision, double precision) TO anon;
