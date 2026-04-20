-- =============================================================================
-- FIX: Remove todos os overloads de denunciar_cidadao e recria versão única
--
-- Problema: múltiplos overloads (5, 6 e 7 params) coexistem no banco.
-- PostgREST retorna 400 "ambiguous function" ao receber todos os 7 params.
-- Adicionalmente, o GRANT do overload de 7 params estava faltando para anon.
-- =============================================================================

-- 1. Dropar TODOS os overloads existentes
DROP FUNCTION IF EXISTS public.denunciar_cidadao(text, uuid, text);
DROP FUNCTION IF EXISTS public.denunciar_cidadao(text, uuid, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.denunciar_cidadao(text, uuid, text, double precision, double precision, text);
DROP FUNCTION IF EXISTS public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text);

-- 2. Recriar versão única com 7 params (últimos 4 com DEFAULT NULL)
CREATE FUNCTION public.denunciar_cidadao(
  p_slug            text,
  p_bairro_id       uuid    DEFAULT NULL,
  p_descricao       text    DEFAULT NULL,
  p_latitude        double precision DEFAULT NULL,
  p_longitude       double precision DEFAULT NULL,
  p_foto_url        text    DEFAULT NULL,
  p_foto_public_id  text    DEFAULT NULL
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
  -- 1. Resolver cliente pelo slug
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE slug = p_slug AND ativo = true;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  -- 2. Rate limit por IP (janela de 30 minutos)
  v_ip_raw  := COALESCE(
    split_part(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ',', 1),
    'unknown'
  );
  v_ip_hash := md5(trim(v_ip_raw) || v_cliente_id::text);
  v_janela  := date_trunc('hour', now())
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
      'ok', false,
      'error', 'Muitas denúncias registradas neste local. Aguarde ' || v_janela_min || ' minutos.'
    );
  END IF;

  -- 3. Deduplicação geoespacial: foco cidadão próximo (30m) nas últimas 24h
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

  -- 4. Resolver região pelo bairro_id (opcional)
  IF p_bairro_id IS NOT NULL THEN
    SELECT id INTO v_regiao_id
    FROM public.regioes
    WHERE id = p_bairro_id AND cliente_id = v_cliente_id;
  END IF;

  -- 5. Ciclo atual (1–6 por ano, 2 meses cada)
  v_ciclo := CEIL(EXTRACT(MONTH FROM now())::int / 2.0)::int;

  -- 6. Criar foco_risco
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
    LEFT(p_descricao, 500),
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

-- 3. GRANT para anon (cidadão sem login) e authenticated
GRANT EXECUTE ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text)
  TO anon, authenticated;
