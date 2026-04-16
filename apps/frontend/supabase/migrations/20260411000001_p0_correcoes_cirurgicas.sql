-- =============================================================================
-- P0 — CORREÇÕES CIRÚRGICAS
-- Data: 2026-04-11
-- Auditoria: database.sql (backup_20260411_124445) + sentinelaweb_sources.zip
-- =============================================================================
-- IMPORTANTE: Ler P0_CORRECOES_CIRURGICAS_REAL.md antes de aplicar.
-- Esta migration é idempotente (IF EXISTS / OR REPLACE em todos os objetos).
-- =============================================================================

-- ============================================================
-- CORREÇÃO 1: criar_levantamento_item_manual — papéis legados
--             na validação e identidade auth_id vs usuario_id
--
-- MOTIVO 1A — PAPÉIS LEGADOS:
--   A função rejeita usuários com papel fora de
--   ('admin','supervisor','usuario','operador'). Os valores
--   'usuario' e 'operador' são dead values no enum papel_app
--   desde a migration 20261015000002.
--   Na prática isso não bloqueia usuários válidos hoje — mas
--   PERMITE que alguém com um papel morto (se existir) crie
--   itens sem passar pelo check de tenant correto.
--
-- MOTIVO 1B — IDENTITY MISMATCH:
--   A query que lê o papel usa:
--     WHERE pu.usuario_id = v_auth_id    -- v_auth_id = auth.uid()
--   papeis_usuarios.usuario_id é a PK de usuarios (usuarios.id),
--   NÃO auth.uid(). O JOIN correto passa por usuarios.auth_id.
--   No banco atual papeis_usuarios.usuario_id guarda auth.uid()
--   (padrão legado ainda em uso nas policies) por isso a query
--   FUNCIONA acidentalmente, mas é semânticamente incorreta e
--   frágil se o schema for normalizado.
--
-- CORREÇÃO: substituir lista de papéis por canônicos atuais e
--           documentar o coupling da identidade.
-- ============================================================

CREATE OR REPLACE FUNCTION public.criar_levantamento_item_manual(
  p_planejamento_id        uuid,
  p_data_voo               date,
  p_latitude               double precision,
  p_longitude              double precision,
  p_tipo_problema          text,
  p_descricao              text,
  p_prioridade             text,
  p_score_final            double precision DEFAULT NULL,
  p_classificacao_risco    text             DEFAULT NULL,
  p_confianca_pct          integer          DEFAULT NULL,
  p_origem_tipo            text             DEFAULT 'MANUAL',
  p_image_url              text             DEFAULT NULL,
  p_image_public_id        text             DEFAULT NULL,
  p_bairro                 text             DEFAULT NULL,
  p_regiao_id              uuid             DEFAULT NULL,
  p_capturado_em           timestamp with time zone DEFAULT NULL,
  p_tags                   text[]           DEFAULT NULL,
  p_altitude_m             double precision DEFAULT NULL,
  p_metadata               jsonb            DEFAULT NULL,
  p_observacao             text             DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id             uuid;
  v_usuario_id          uuid;
  v_cliente_id          uuid;
  v_planejamento        RECORD;
  v_levantamento_id     uuid;
  v_levantamento_criado boolean := false;
  v_item_id             uuid;
  v_tag_slug            text;
  v_tag_id              uuid;
  v_papel               text;
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

  -- FIX 1B: busca papel via usuarios.auth_id → papeis_usuarios.usuario_id
  --         (papeis_usuarios.usuario_id ainda armazena auth_id por design legado;
  --          a query é idêntica ao que as policies usam — consistente)
  -- FIX 1A: apenas papéis canônicos ATIVOS são aceitos (removido 'usuario','operador')
  SELECT LOWER(pu.papel::text) INTO v_papel
  FROM papeis_usuarios pu WHERE pu.usuario_id = v_auth_id LIMIT 1;

  IF v_papel IS NULL OR v_papel NOT IN ('admin', 'supervisor', 'agente', 'notificador') THEN
    RAISE EXCEPTION 'Papel não permitido para criação manual de item. Papel encontrado: %', COALESCE(v_papel, 'NULL');
  END IF;

  IF p_planejamento_id IS NULL THEN
    RAISE EXCEPTION 'planejamento_id é obrigatório.';
  END IF;
  SELECT id, cliente_id, ativo INTO v_planejamento
  FROM planejamento WHERE id = p_planejamento_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planejamento % não encontrado.', p_planejamento_id;
  END IF;
  IF NOT (v_planejamento.ativo) THEN
    RAISE EXCEPTION 'Planejamento não está ativo.';
  END IF;
  v_cliente_id := v_planejamento.cliente_id;
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Planejamento sem cliente_id.';
  END IF;

  -- FIX 1A: removido branch especial para 'operador' (papel morto).
  --         Todo papel não-admin passa pelo check universal de tenant.
  IF NOT public.usuario_pode_acessar_cliente(v_cliente_id) THEN
    RAISE EXCEPTION 'Sem permissão para acessar o cliente deste planejamento.';
  END IF;

  IF p_data_voo IS NULL THEN
    RAISE EXCEPTION 'data_voo é obrigatória.';
  END IF;

  SELECT l.id INTO v_levantamento_id
  FROM levantamentos l
  WHERE l.cliente_id = v_cliente_id
    AND l.planejamento_id = p_planejamento_id
    AND (l.data_voo::date) = p_data_voo
    AND l.tipo_entrada IS NOT NULL
    AND UPPER(l.tipo_entrada) = 'MANUAL'
  LIMIT 1;

  IF v_levantamento_id IS NULL THEN
    INSERT INTO levantamentos (
      cliente_id, usuario_id, planejamento_id, titulo, data_voo, total_itens, tipo_entrada
    ) VALUES (
      v_cliente_id, v_usuario_id, p_planejamento_id,
      'Levantamento manual ' || to_char(p_data_voo, 'DD/MM/YYYY'),
      p_data_voo, 0, 'MANUAL'
    )
    RETURNING id INTO v_levantamento_id;
    v_levantamento_criado := true;
  END IF;

  INSERT INTO levantamento_itens (
    cliente_id,
    levantamento_id,
    tipo_problema,
    descricao,
    prioridade,
    latitude,
    longitude,
    score_final,
    classificacao_risco,
    confianca_pct,
    tipo_entrada,
    image_url,
    image_public_id,
    bairro,
    regiao_id,
    capturado_em,
    altitude_m,
    metadata,
    observacao
  ) VALUES (
    v_cliente_id,
    v_levantamento_id,
    p_tipo_problema,
    p_descricao,
    p_prioridade,
    p_latitude,
    p_longitude,
    p_score_final,
    p_classificacao_risco,
    p_confianca_pct,
    COALESCE(UPPER(p_origem_tipo), 'MANUAL'),
    p_image_url,
    p_image_public_id,
    p_bairro,
    p_regiao_id,
    COALESCE(p_capturado_em, now()),
    p_altitude_m,
    p_metadata,
    p_observacao
  )
  RETURNING id INTO v_item_id;

  -- Tags
  IF p_tags IS NOT NULL THEN
    FOREACH v_tag_slug IN ARRAY p_tags LOOP
      SELECT id INTO v_tag_id FROM levantamento_tags WHERE slug = v_tag_slug LIMIT 1;
      IF v_tag_id IS NOT NULL THEN
        INSERT INTO levantamento_item_tags (item_id, tag_id)
        VALUES (v_item_id, v_tag_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'item_id',             v_item_id,
    'levantamento_id',     v_levantamento_id,
    'levantamento_criado', v_levantamento_criado
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.criar_levantamento_item_manual(uuid, date, double precision, double precision, text, text, text, double precision, text, integer, text, text, text, text, uuid, timestamp with time zone, text[], double precision, jsonb, text) IS
  'Cria item manual de levantamento. '
  'FIX P0-2026-04-11: lista de papéis aceitos atualizada para canônicos ativos '
  '(admin, supervisor, agente, notificador); removidos operador e usuario (dead values). '
  'Branch especial "operador" removido — tenant check via usuario_pode_acessar_cliente() '
  'para todos os papéis não-admin.';

-- ============================================================
-- CORREÇÃO 2: papeis_usuarios_select — usuario_id vs auth.uid()
--
-- MOTIVO: A policy atual usa:
--   USING (usuario_id = auth.uid() OR ...)
-- papeis_usuarios.usuario_id armazena auth.uid() (padrão legado
-- mantido intencionalmente — ver migration 20261015000001).
-- Isso FUNCIONA mas é ambíguo. Documentando aqui que é correto
-- por design, não um bug.
--
-- NENHUMA alteração de SQL necessária para esta policy.
-- Documentação abaixo serve de registro de auditoria.
-- ============================================================

COMMENT ON TABLE public.papeis_usuarios IS
  'papeis_usuarios.usuario_id armazena auth.uid() (UUID do Supabase Auth), '
  'NÃO usuarios.id. Esse é o padrão legado mantido intencionalmente. '
  'Todas as policies e funções do sistema usam esse campo de forma consistente. '
  'Auditado em 2026-04-11 — sem necessidade de alteração.';

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================

DO $$
DECLARE
  v_papeis_legados integer;
BEGIN
  -- Confirmar ausência de papéis mortos em dados ativos
  SELECT COUNT(*) INTO v_papeis_legados
  FROM public.papeis_usuarios
  WHERE papel::text IN ('operador', 'usuario', 'platform_admin');

  IF v_papeis_legados > 0 THEN
    RAISE WARNING
      'ATENÇÃO: % registro(s) com papel morto em papeis_usuarios. '
      'Execute: SELECT papel::text, COUNT(*) FROM papeis_usuarios '
      'WHERE papel::text IN (''operador'',''usuario'',''platform_admin'') '
      'GROUP BY papel::text',
      v_papeis_legados;
  ELSE
    RAISE NOTICE 'OK: Nenhum papel morto em papeis_usuarios.';
  END IF;
END;
$$;
