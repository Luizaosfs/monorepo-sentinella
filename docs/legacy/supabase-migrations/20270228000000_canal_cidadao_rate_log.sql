-- P7.12 — Log de eventos do canal cidadão (rate limit + deduplicação)
-- Cria tabela de auditoria de eventos e atualiza denunciar_cidadao
-- para registrar RATE_LIMIT, DEDUPLICADO e ACEITO.
--
-- Segurança:
--   - ip_hash é MD5 do IP + cliente_id — nunca o IP bruto
--   - RLS: admin vê tudo; supervisor/agente vê apenas seu cliente
--   - Log é fire-and-forget dentro de BEGIN/EXCEPTION — nunca bloqueia a denúncia

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabela de log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.canal_cidadao_rate_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ip_hash     text        NOT NULL,           -- MD5(ip || cliente_id) — sem PII
  motivo      text        NOT NULL,           -- RATE_LIMIT | DEDUPLICADO | ACEITO
  foco_id     uuid,                           -- foco criado ou deduplicado (nullable)
  detalhes    jsonb,                          -- contexto extra opcional
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.canal_cidadao_rate_log ENABLE ROW LEVEL SECURITY;

-- Admin: visão global
CREATE POLICY "admin_vê_todos_rate_log" ON public.canal_cidadao_rate_log
  FOR SELECT
  USING (public.tem_papel(auth.uid(), 'admin'::public.papel_app));

-- Supervisor/gestor: apenas seu cliente
CREATE POLICY "supervisor_vê_rate_log_cliente" ON public.canal_cidadao_rate_log
  FOR SELECT
  USING (
    cliente_id IN (
      SELECT cliente_id FROM public.usuarios
      WHERE auth_id = auth.uid() AND ativo = true
    )
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

-- Apenas SECURITY DEFINER (service_role) pode inserir — frontend não tem acesso direto
REVOKE INSERT, UPDATE, DELETE ON public.canal_cidadao_rate_log FROM PUBLIC, authenticated, anon;
GRANT INSERT ON public.canal_cidadao_rate_log TO service_role;

CREATE INDEX ON public.canal_cidadao_rate_log (cliente_id, created_at DESC);
CREATE INDEX ON public.canal_cidadao_rate_log (motivo, created_at DESC);

COMMENT ON TABLE public.canal_cidadao_rate_log IS
  'Log imutável de eventos do canal cidadão: bloqueios de rate limit, '
  'deduplicações e denúncias aceitas. ip_hash é MD5 sem dados brutos. '
  'Inserção exclusiva via SECURITY DEFINER em denunciar_cidadao.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Atualizar denunciar_cidadao para registrar eventos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.denunciar_cidadao(
  p_slug          text,
  p_bairro_id     uuid    DEFAULT NULL,
  p_descricao     text    DEFAULT NULL,
  p_latitude      float8  DEFAULT NULL,
  p_longitude     float8  DEFAULT NULL,
  p_foto_url      text    DEFAULT NULL,
  p_foto_public_id text   DEFAULT NULL
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
  SELECT id INTO v_cliente_id FROM public.clientes WHERE slug = p_slug AND ativo = true;
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Canal não encontrado.');
  END IF;

  -- 3. Rate limit por IP (janela de 30 minutos)
  v_ip_raw  := current_setting('request.headers', true)::jsonb->>'x-real-ip';
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
  'Registra eventos (RATE_LIMIT, DEDUPLICADO, ACEITO) em canal_cidadao_rate_log. '
  'Log é fire-and-forget — nunca bloqueia o fluxo principal.';
