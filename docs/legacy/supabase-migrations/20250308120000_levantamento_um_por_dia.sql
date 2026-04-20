-- =============================================================================
-- REGRA: Apenas um levantamento por (cliente, planejamento, data, tipo_entrada).
-- 1. Consolida duplicatas existentes (move itens para um e remove os outros).
-- 2. Índice UNIQUE para impedir novas duplicatas.
-- 3. RPC criar_levantamento_item_manual: em caso de race (unique_violation), reutiliza o levantamento existente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Consolidar duplicatas: mesmo cliente, planejamento, data (dia), tipo_entrada
--    Mantém o levantamento com menor id; move itens dos outros para ele; remove os outros.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_manter_id uuid;
  v_duplicados uuid[];
BEGIN
  FOR r IN (
    SELECT
      l.cliente_id,
      l.planejamento_id,
      (l.data_voo::date) AS dia,
      UPPER(TRIM(l.tipo_entrada)) AS tipo_entrada,
      array_agg(l.id ORDER BY l.id) AS ids
    FROM levantamentos l
    WHERE l.planejamento_id IS NOT NULL
      AND l.tipo_entrada IS NOT NULL
      AND TRIM(l.tipo_entrada) <> ''
    GROUP BY l.cliente_id, l.planejamento_id, (l.data_voo::date), UPPER(TRIM(l.tipo_entrada))
    HAVING count(*) > 1
  )
  LOOP
    v_manter_id := r.ids[1];
    v_duplicados := r.ids[2:array_length(r.ids, 1)];

    UPDATE levantamento_itens
    SET levantamento_id = v_manter_id
    WHERE levantamento_id = ANY(v_duplicados);

    DELETE FROM levantamentos
    WHERE id = ANY(v_duplicados);

    UPDATE levantamentos
    SET total_itens = (SELECT count(*) FROM levantamento_itens WHERE levantamento_id = v_manter_id)
    WHERE id = v_manter_id;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Índice UNIQUE: um levantamento por (cliente, planejamento, dia, tipo_entrada)
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uix_levantamentos_cliente_planejamento_data_tipo
  ON public.levantamentos (
    cliente_id,
    planejamento_id,
    ((data_voo)::date),
    tipo_entrada
  )
  WHERE planejamento_id IS NOT NULL
    AND tipo_entrada IS NOT NULL
    AND TRIM(tipo_entrada) <> '';

COMMENT ON INDEX public.uix_levantamentos_cliente_planejamento_data_tipo IS
  'Garante no máximo um levantamento por cliente, planejamento, data (dia) e tipo_entrada (1 levantamento por dia por planejamento/tipo).';

-- -----------------------------------------------------------------------------
-- 3. RPC: em caso de unique_violation (condição de corrida), reutilizar levantamento
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_levantamento_item_manual(
  p_planejamento_id uuid,
  p_data_voo date,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_item text DEFAULT NULL,
  p_risco text DEFAULT NULL,
  p_acao text DEFAULT NULL,
  p_score_final double precision DEFAULT NULL,
  p_prioridade text DEFAULT NULL,
  p_sla_horas integer DEFAULT NULL,
  p_endereco_curto text DEFAULT NULL,
  p_endereco_completo text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_maps text DEFAULT NULL,
  p_waze text DEFAULT NULL,
  p_data_hora timestamptz DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_peso double precision DEFAULT NULL,
  p_payload jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid;
  v_usuario_id uuid;
  v_cliente_id uuid;
  v_planejamento RECORD;
  v_tipo_entrada text;
  v_levantamento_id uuid;
  v_levantamento_criado boolean := false;
  v_item_id uuid;
  v_tag_slug text;
  v_tag_id uuid;
  v_papel text;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT u.id, u.cliente_id INTO v_usuario_id, v_cliente_id
  FROM usuarios u WHERE u.auth_id = v_auth_id LIMIT 1;
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado em public.usuarios.';
  END IF;

  SELECT LOWER(pu.papel::text) INTO v_papel
  FROM papeis_usuarios pu WHERE pu.usuario_id = v_auth_id LIMIT 1;
  IF v_papel IS NULL OR v_papel NOT IN ('admin', 'supervisor', 'usuario', 'operador') THEN
    RAISE EXCEPTION 'Papel não permitido para criação manual de item. Apenas admin, supervisor, usuario ou operador.';
  END IF;

  IF p_planejamento_id IS NULL THEN
    RAISE EXCEPTION 'planejamento_id é obrigatório.';
  END IF;
  SELECT id, cliente_id, ativo, tipo_levantamento INTO v_planejamento
  FROM planejamento WHERE id = p_planejamento_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planejamento % não encontrado.', p_planejamento_id;
  END IF;
  IF NOT (v_planejamento.ativo) THEN
    RAISE EXCEPTION 'Planejamento não está ativo. Selecione um planejamento ativo.';
  END IF;
  v_cliente_id := v_planejamento.cliente_id;
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Planejamento sem cliente_id.';
  END IF;

  v_tipo_entrada := UPPER(TRIM(COALESCE(v_planejamento.tipo_levantamento, 'MANUAL')));
  IF v_tipo_entrada NOT IN ('DRONE', 'MANUAL') THEN
    v_tipo_entrada := 'MANUAL';
  END IF;

  IF v_papel = 'operador' THEN
    IF (SELECT u.cliente_id FROM usuarios u WHERE u.auth_id = v_auth_id LIMIT 1) IS DISTINCT FROM v_cliente_id THEN
      RAISE EXCEPTION 'Operador só pode criar itens para o cliente ao qual está vinculado.';
    END IF;
  ELSE
    IF NOT public.usuario_pode_acessar_cliente(v_cliente_id) THEN
      RAISE EXCEPTION 'Sem permissão para acessar o cliente deste planejamento.';
    END IF;
  END IF;

  IF p_data_voo IS NULL THEN
    RAISE EXCEPTION 'data_voo é obrigatória.';
  END IF;

  -- Buscar levantamento existente (cliente, planejamento, data_voo, tipo_entrada)
  SELECT l.id INTO v_levantamento_id
  FROM levantamentos l
  WHERE l.cliente_id = v_cliente_id
    AND l.planejamento_id = p_planejamento_id
    AND (l.data_voo::date) = p_data_voo
    AND l.tipo_entrada IS NOT NULL
    AND UPPER(TRIM(l.tipo_entrada)) = v_tipo_entrada
  LIMIT 1;

  IF v_levantamento_id IS NULL THEN
    BEGIN
      INSERT INTO levantamentos (
        cliente_id, usuario_id, planejamento_id, titulo, data_voo, total_itens, tipo_entrada
      ) VALUES (
        v_cliente_id,
        v_usuario_id,
        p_planejamento_id,
        'Levantamento ' || LOWER(v_tipo_entrada) || ' ' || to_char(p_data_voo, 'DD/MM/YYYY'),
        p_data_voo,
        0,
        v_tipo_entrada
      )
      RETURNING id INTO v_levantamento_id;
      v_levantamento_criado := true;
    EXCEPTION
      WHEN unique_violation THEN
        -- Condição de corrida: outro request criou o levantamento entre nosso SELECT e INSERT
        SELECT l.id INTO v_levantamento_id
        FROM levantamentos l
        WHERE l.cliente_id = v_cliente_id
          AND l.planejamento_id = p_planejamento_id
          AND (l.data_voo::date) = p_data_voo
          AND l.tipo_entrada IS NOT NULL
          AND UPPER(TRIM(l.tipo_entrada)) = v_tipo_entrada
        LIMIT 1;
        IF v_levantamento_id IS NULL THEN
          RAISE;
        END IF;
    END;
  END IF;

  INSERT INTO levantamento_itens (
    levantamento_id,
    latitude, longitude, item, risco, peso, acao, score_final, prioridade, sla_horas,
    endereco_curto, endereco_completo, image_url, maps, waze, data_hora, payload
  ) VALUES (
    v_levantamento_id,
    p_latitude, p_longitude, p_item, p_risco, p_peso, p_acao, p_score_final, p_prioridade, p_sla_horas,
    p_endereco_curto, p_endereco_completo, p_image_url, p_maps, p_waze,
    COALESCE(p_data_hora, now()),
    p_payload
  )
  RETURNING id INTO v_item_id;

  UPDATE levantamentos
  SET total_itens = (SELECT count(*) FROM levantamento_itens WHERE levantamento_id = v_levantamento_id)
  WHERE id = v_levantamento_id;

  IF p_tags IS NOT NULL AND array_length(p_tags, 1) > 0 THEN
    FOREACH v_tag_slug IN ARRAY p_tags
    LOOP
      SELECT id INTO v_tag_id FROM tags WHERE slug = v_tag_slug LIMIT 1;
      IF v_tag_id IS NOT NULL THEN
        INSERT INTO levantamento_item_tags (levantamento_item_id, tag_id)
        VALUES (v_item_id, v_tag_id)
        ON CONFLICT (levantamento_item_id, tag_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'levantamento_item', (SELECT to_jsonb(li.*) FROM levantamento_itens li WHERE li.id = v_item_id),
    'levantamento_criado', v_levantamento_criado,
    'levantamento_id', v_levantamento_id
  );
END;
$$;

COMMENT ON FUNCTION public.criar_levantamento_item_manual IS
  'Cria um levantamento_item: reutiliza levantamento do mesmo dia/tipo ou cria um novo. Garante 1 levantamento por (cliente, planejamento, data, tipo). Em race condition (unique_violation), reutiliza o levantamento já criado.';
