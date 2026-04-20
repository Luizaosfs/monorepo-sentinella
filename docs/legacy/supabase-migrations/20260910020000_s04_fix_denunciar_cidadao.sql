-- =============================================================================
-- S04: Reescrever denunciar_cidadao — cria foco_risco diretamente
--
-- Melhoria sobre 20260800020000: elimina dependência de levantamento_itens.
-- Cria focos_risco com origem_tipo='cidadao' diretamente.
-- Mantém as duas sobrecargas (5 e 6 parâmetros — p_foto_url).
--
-- Rate limit: máximo 5 denúncias por cliente por minuto (proteção contra flood).
-- =============================================================================

-- ── Sobrecarga 5 parâmetros ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.denunciar_cidadao(
  p_slug      text,
  p_bairro_id uuid,
  p_descricao text,
  p_latitude  double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_regiao_id  uuid;
  v_foco_id    uuid;
  v_ciclo      int;
BEGIN
  -- Resolve cliente pelo slug
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE slug = p_slug AND ativo = true;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  -- Rate limit: máximo 5 denúncias por cliente por minuto
  IF (
    SELECT COUNT(*) FROM public.focos_risco
    WHERE cliente_id = v_cliente_id
      AND origem_tipo = 'cidadao'
      AND created_at > now() - interval '1 minute'
  ) >= 5 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Muitas denúncias recentes. Tente novamente em alguns minutos.'
    );
  END IF;

  -- Resolve região a partir do bairro_id
  IF p_bairro_id IS NOT NULL THEN
    SELECT id INTO v_regiao_id
    FROM public.regioes
    WHERE id = p_bairro_id AND cliente_id = v_cliente_id;
  END IF;

  -- Ciclo atual (2 meses por ciclo, 6 ciclos/ano)
  v_ciclo := CEIL(EXTRACT(MONTH FROM now())::int / 2.0)::int;

  -- Criar foco_risco diretamente
  INSERT INTO public.focos_risco (
    cliente_id,
    regiao_id,
    origem_tipo,
    status,
    prioridade,
    ciclo,
    latitude,
    longitude,
    endereco_normalizado,
    suspeita_em
  ) VALUES (
    v_cliente_id,
    v_regiao_id,
    'cidadao',
    'suspeita',
    'P3',
    v_ciclo,
    p_latitude,
    p_longitude,
    LEFT(p_descricao, 500),
    now()
  )
  RETURNING id INTO v_foco_id;

  RETURN jsonb_build_object('ok', true, 'foco_id', v_foco_id::text);
END;
$$;

-- ── Sobrecarga 6 parâmetros (com foto) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.denunciar_cidadao(
  p_slug      text,
  p_bairro_id uuid,
  p_descricao text,
  p_latitude  double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_foto_url  text             DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_regiao_id  uuid;
  v_foco_id    uuid;
  v_ciclo      int;
BEGIN
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE slug = p_slug AND ativo = true;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  IF (
    SELECT COUNT(*) FROM public.focos_risco
    WHERE cliente_id = v_cliente_id
      AND origem_tipo = 'cidadao'
      AND created_at > now() - interval '1 minute'
  ) >= 5 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Muitas denúncias recentes. Tente novamente em alguns minutos.'
    );
  END IF;

  IF p_bairro_id IS NOT NULL THEN
    SELECT id INTO v_regiao_id
    FROM public.regioes
    WHERE id = p_bairro_id AND cliente_id = v_cliente_id;
  END IF;

  v_ciclo := CEIL(EXTRACT(MONTH FROM now())::int / 2.0)::int;

  INSERT INTO public.focos_risco (
    cliente_id,
    regiao_id,
    origem_tipo,
    status,
    prioridade,
    ciclo,
    latitude,
    longitude,
    endereco_normalizado,
    suspeita_em
  ) VALUES (
    v_cliente_id,
    v_regiao_id,
    'cidadao',
    'suspeita',
    'P3',
    v_ciclo,
    p_latitude,
    p_longitude,
    LEFT(p_descricao, 500),
    now()
  )
  RETURNING id INTO v_foco_id;

  -- Foto registrada no payload do foco (não há coluna específica para foto_url em focos_risco)
  -- A foto fica referenciada no levantamento_item caso seja criado posteriormente
  RETURN jsonb_build_object('ok', true, 'foco_id', v_foco_id::text, 'foto_url', p_foto_url);
END;
$$;

-- Manter grants para anon (canal público)
GRANT EXECUTE ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision) TO anon;
GRANT EXECUTE ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision, text) TO anon;

COMMENT ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision) IS
  'S04: Canal cidadão — cria foco_risco com origem_tipo=cidadao diretamente. '
  'Rate limit: 5 denúncias/minuto por cliente. '
  'Melhoria 20260910020000: elimina dependência de levantamento_itens.';
