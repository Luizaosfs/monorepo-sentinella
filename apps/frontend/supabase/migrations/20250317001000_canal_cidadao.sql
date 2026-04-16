-- RPC pública para receber denúncias de cidadãos (SECURITY DEFINER)
-- Busca ou cria um levantamento do tipo 'canal_cidadao' para o cliente
-- e insere o levantamento_item com payload.fonte = 'cidadao'

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
BEGIN
  -- Resolve cliente pelo slug
  SELECT id INTO v_cliente_id FROM clientes WHERE slug = p_slug AND ativo = true;
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  -- Busca ou cria levantamento do canal cidadão (um por cliente, tipo 'canal_cidadao')
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
    jsonb_build_object('fonte', 'cidadao', 'bairro_id', p_bairro_id::text, 'descricao_original', p_descricao),
    'pendente'
  )
  RETURNING id INTO v_item_id;

  -- Atualiza contador
  UPDATE levantamentos SET total_itens = total_itens + 1 WHERE id = v_lev_id;

  RETURN jsonb_build_object('ok', true, 'item_id', v_item_id::text);
END;
$$;

-- Grant de execução para usuários anônimos (canal público)
GRANT EXECUTE ON FUNCTION denunciar_cidadao TO anon;
