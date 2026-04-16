-- =============================================================================
-- FIX FINAL: denunciar_cidadao — mescla S04 + QW-10B
--
-- Contexto:
--   - S04 (20260914000000_cleanup01) criou versão correta que grava foco_risco,
--     mas sem rate limit por IP nem deduplicação geoespacial.
--   - QW-10B (20260720000000) adicionou rate limit + dedup, mas buscava em
--     levantamento_itens.status_atendimento (coluna removida em 20260711).
--   - 20260800020000 fez fix parcial mas ainda referencia levantamento_itens.
--
-- Esta migration:
--   1. Substitui denunciar_cidadao pela versão completa:
--      - Rate limit via canal_cidadao_rate_limit (5 por 30min por IP+cliente)
--      - Deduplicação PostGIS 30m / 24h em focos_risco (origem_tipo='cidadao')
--      - Cria foco_risco com payload rastreável
--   2. Substitui consultar_denuncia_cidadao para buscar diretamente em
--      focos_risco (elimina compat shim com information_schema)
-- =============================================================================

-- =============================================================================
-- 1. denunciar_cidadao — versão final consolidada
-- =============================================================================
CREATE OR REPLACE FUNCTION public.denunciar_cidadao(
  p_slug            text,
  p_bairro_id       uuid,
  p_descricao       text,
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
  -- 1. Resolver cliente pelo slug
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE slug = p_slug AND ativo = true;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  -- 2. Rate limit por IP (janela de 30 minutos)
  --    IP extraído do header Supabase/PostgREST; se ausente, usa string fixa.
  v_ip_raw  := COALESCE(
    split_part(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ',', 1),
    'unknown'
  );
  v_ip_hash := md5(trim(v_ip_raw) || v_cliente_id::text);
  -- Janela: floor(minuto / 30) — muda a cada 30 minutos
  v_janela  := date_trunc('hour', now())
               + INTERVAL '30 minutes'
               * FLOOR(EXTRACT(minute FROM now()) / 30);

  INSERT INTO public.canal_cidadao_rate_limit (ip_hash, cliente_id, janela_hora, contagem)
  VALUES (v_ip_hash, v_cliente_id, v_janela, 1)
  ON CONFLICT (ip_hash, cliente_id, janela_hora)
  DO UPDATE SET contagem = canal_cidadao_rate_limit.contagem + 1
  RETURNING contagem INTO v_contagem;

  IF v_contagem > v_limite THEN
    -- Reverter o incremento para não penalizar contagens futuras após o bloqueio
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
      -- Incrementar confirmações no payload do foco existente
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

GRANT EXECUTE ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text)
  TO anon, authenticated;

COMMENT ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text) IS
  'Canal cidadão: cria foco_risco com origem_tipo=cidadao. '
  'Rate limit: 5 denúncias por IP por janela de 30min (canal_cidadao_rate_limit). '
  'Deduplicação: foco existente em raio 30m nas últimas 24h incrementa confirmacoes sem criar novo. '
  'Versão final — mescla S04 + QW-10B. Substituída em FIX FINAL (20260915000000). '
  'Parâmetros: p_slug, p_bairro_id, p_descricao, p_latitude?, p_longitude?, p_foto_url?, p_foto_public_id?.';

-- =============================================================================
-- 2. consultar_denuncia_cidadao — busca direto em focos_risco
--    Remove o compat shim com information_schema (status_atendimento removido
--    em 20260711000000 — a coluna definitivamente não existe mais)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.consultar_denuncia_cidadao(p_protocolo text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
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
          WHEN 'confirmado'       THEN 'O foco foi confirmado e está em fila de atendimento.'
          WHEN 'em_tratamento'    THEN 'A equipe municipal está realizando o tratamento no local.'
          WHEN 'resolvido'        THEN 'O foco foi resolvido. Obrigado pela sua denúncia!'
          WHEN 'descartado'       THEN 'Após análise, o local foi considerado sem risco no momento.'
          ELSE                         'Status em processamento.'
        END
      )
      FROM public.focos_risco fr
      WHERE starts_with(fr.id::text, lower(trim(p_protocolo)))
        AND fr.origem_tipo = 'cidadao'
        AND fr.deleted_at  IS NULL
      LIMIT 1
    ),
    jsonb_build_object('ok', false, 'error', 'Protocolo não encontrado.')
  );
$$;

GRANT EXECUTE ON FUNCTION public.consultar_denuncia_cidadao(text) TO anon, authenticated;

COMMENT ON FUNCTION public.consultar_denuncia_cidadao(text) IS
  'Consulta pública de denúncia pelo protocolo (primeiros 8 chars do UUID do foco_risco). '
  'Busca diretamente em focos_risco.origem_tipo=cidadao — compat shim com information_schema removido. '
  'Atualizado em FIX FINAL (20260915000000).';
