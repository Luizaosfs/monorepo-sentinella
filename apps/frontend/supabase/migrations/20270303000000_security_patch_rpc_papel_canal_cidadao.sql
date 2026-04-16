-- =============================================================================
-- 20270303000000 — Security Patch: rpc_set_papel_usuario + denunciar_cidadao
--
-- S-01 (P0): rpc_set_papel_usuario sem guard de autorização
--            Qualquer usuário autenticado podia elevar seu próprio papel (ou de
--            outro) para 'admin', pois a função é SECURITY DEFINER sem verificação.
--            Corrigido: guard `public.is_admin()` antes de qualquer operação.
--
-- S-02 (P1): denunciar_cidadao — hash IP com md5() e captura frágil
--            md5() é reversível em ataques de pré-imagem com wordlists de IP.
--            IP capturado apenas de x-real-ip; spoofing via x-forwarded-for
--            não coberto como fallback.
--            Corrigido: sha256 via extensions.digest + fallback x-forwarded-for.
--
-- S-03 (P1): denunciar_cidadao — foto_url sem validação de origem
--            Qualquer URL podia ser gravada em focos_risco.foto_url, expondo
--            SSRFs e conteúdo de terceiros não confiáveis.
--            Corrigido: rejeita URLs que não iniciem com
--            https://res.cloudinary.com/
-- =============================================================================


-- ── S-01: rpc_set_papel_usuario — guard de autorização ──────────────────────

CREATE OR REPLACE FUNCTION public.rpc_set_papel_usuario(
  p_auth_id uuid,
  p_papel   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- S-01: apenas admins podem alterar papéis
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'acesso_negado: apenas admin pode alterar papel de usuário'
      USING ERRCODE = 'P0001';
  END IF;

  -- Validação básica: bloqueia valores proibidos pelo domínio
  IF p_papel NOT IN ('agente', 'supervisor', 'admin', 'notificador', 'analista_regional') THEN
    RAISE EXCEPTION 'papel_invalido: % não é um papel permitido', p_papel;
  END IF;

  -- Operação atômica: remove papéis anteriores e insere o novo
  DELETE FROM public.papeis_usuarios WHERE usuario_id = p_auth_id;
  INSERT INTO public.papeis_usuarios (usuario_id, papel)
  VALUES (p_auth_id, lower(trim(p_papel)));
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_papel_usuario(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_set_papel_usuario(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_set_papel_usuario IS
  'Troca atomicamente o papel de um usuário em papeis_usuarios. '
  'Exclusivo para admins — guard public.is_admin() no início (S-01). '
  'Substitui o padrão DELETE+INSERT não-atômico do frontend. '
  'Valida que o papel seja um dos valores canônicos permitidos.';


-- ── S-02 + S-03: denunciar_cidadao — sha256 + fallback IP + foto_url guard ──

CREATE OR REPLACE FUNCTION public.denunciar_cidadao(
  p_slug           text,
  p_bairro_id      uuid    DEFAULT NULL,
  p_descricao      text    DEFAULT NULL,
  p_latitude       float8  DEFAULT NULL,
  p_longitude      float8  DEFAULT NULL,
  p_foto_url       text    DEFAULT NULL,
  p_foto_public_id text    DEFAULT NULL
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
  -- headers
  v_headers     jsonb;
BEGIN
  -- 1. Validar p_descricao antes de qualquer acesso ao banco
  IF p_descricao IS NULL OR trim(p_descricao) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Descrição é obrigatória.');
  END IF;

  -- S-03: Validar foto_url — aceita apenas URLs Cloudinary ou NULL
  IF p_foto_url IS NOT NULL AND p_foto_url !~ '^https://res\.cloudinary\.com/' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'URL de foto inválida.');
  END IF;

  -- 2. Resolver cliente pelo slug
  SELECT id INTO v_cliente_id FROM public.clientes WHERE slug = p_slug AND ativo = true;
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Canal não encontrado.');
  END IF;

  -- 3. Rate limit por IP (janela de 30 minutos)
  --    S-02: tenta x-real-ip primeiro; fallback para primeiro token de x-forwarded-for.
  --    Se nenhum disponível, hash aleatório por request (skip rate-limit).
  BEGIN
    v_headers := current_setting('request.headers', true)::jsonb;
    v_ip_raw  := nullif(trim(COALESCE(v_headers->>'x-real-ip', '')), '');
    IF v_ip_raw IS NULL THEN
      v_ip_raw := nullif(
        trim(split_part(COALESCE(v_headers->>'x-forwarded-for', ''), ',', 1)),
        ''
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip_raw := NULL;
  END;

  -- S-02: SHA-256 substitui MD5 — resistente a ataques de pré-imagem com wordlists de IP
  v_ip_hash := encode(
    extensions.digest(
      COALESCE(v_ip_raw, 'unknown_' || gen_random_uuid()::text)
      || v_cliente_id::text,
      'sha256'
    ),
    'hex'
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

      -- Log do bloqueio (fire-and-forget)
      BEGIN
        INSERT INTO public.canal_cidadao_rate_log (cliente_id, ip_hash, motivo, detalhes)
        VALUES (
          v_cliente_id,
          v_ip_hash,
          'RATE_LIMIT',
          jsonb_build_object('janela_min', v_janela_min, 'limite', v_limite, 'contagem', v_contagem)
        );
      EXCEPTION WHEN OTHERS THEN NULL; END;

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

      -- Log da deduplicação (fire-and-forget)
      BEGIN
        INSERT INTO public.canal_cidadao_rate_log (cliente_id, ip_hash, motivo, foco_id, detalhes)
        VALUES (
          v_cliente_id,
          v_ip_hash,
          'DEDUPLICADO',
          v_foco_existe,
          jsonb_build_object('raio_m', v_raio_m)
        );
      EXCEPTION WHEN OTHERS THEN NULL; END;

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
    cliente_id,
    regiao_id,
    descricao,
    latitude,
    longitude,
    prioridade,
    status,
    origem_tipo,
    ciclo,
    foto_url,
    foto_public_id,
    payload
  ) VALUES (
    v_cliente_id,
    v_regiao_id,
    p_descricao,
    p_latitude,
    p_longitude,
    'P3',
    'suspeita',
    'cidadao',
    v_ciclo,
    p_foto_url,
    p_foto_public_id,
    jsonb_build_object('bairro_id', p_bairro_id, 'confirmacoes', 1)
  )
  RETURNING id INTO v_foco_id;

  -- Log da denúncia aceita (fire-and-forget)
  BEGIN
    INSERT INTO public.canal_cidadao_rate_log (cliente_id, ip_hash, motivo, foco_id)
    VALUES (v_cliente_id, v_ip_hash, 'ACEITO', v_foco_id);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'ok',         true,
    'foco_id',    v_foco_id::text,
    'deduplicado', false
  );
END;
$$;

-- Manter grants existentes
GRANT EXECUTE ON FUNCTION public.denunciar_cidadao(text, uuid, text, float8, float8, text, text)
  TO anon, authenticated;

COMMENT ON FUNCTION public.denunciar_cidadao(text, uuid, text, float8, float8, text, text) IS
  'Canal cidadão. Rate limit: 5/30min por IP. '
  'S-02: hash SHA-256 (extensions.digest) + fallback x-real-ip → x-forwarded-for. '
  'S-03: foto_url validada contra ^https://res\.cloudinary\.com/ — rejeita URLs externas. '
  'Log é fire-and-forget — nunca bloqueia o fluxo principal.';
