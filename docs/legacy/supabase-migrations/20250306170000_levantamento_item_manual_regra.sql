-- =============================================================================
-- REGRA DE NEGÓCIO: Criação manual de levantamento_itens
-- 1. Campo ativo em planejamento
-- 2. Índice/unicidade para reutilizar levantamento (cliente_id, planejamento_id, data_voo, tipo_entrada)
-- 3. Catálogo de tags e pivot levantamento_item_tags (opcional para drone)
-- 4. Padronização tipo_entrada em levantamentos
-- 5. Função RPC criar_levantamento_item_manual
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PLANEJAMENTO: coluna ativo
-- -----------------------------------------------------------------------------
ALTER TABLE public.planejamento
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.planejamento.ativo IS
  'Se true, o planejamento pode ser selecionado por operador para criar itens manuais. Admin/supervisor/usuario podem ativar/desativar.';

CREATE INDEX IF NOT EXISTS ix_planejamento_ativo
  ON public.planejamento(cliente_id, ativo) WHERE ativo = true;

-- -----------------------------------------------------------------------------
-- 2. LEVANTAMENTOS: garantir tipo_entrada e índice para reuso
-- -----------------------------------------------------------------------------
-- tipo_entrada já existe (text). Constraint para valores permitidos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_levantamentos_tipo_entrada'
  ) THEN
    ALTER TABLE public.levantamentos
      ADD CONSTRAINT chk_levantamentos_tipo_entrada
      CHECK (tipo_entrada IS NULL OR UPPER(TRIM(tipo_entrada)) IN ('DRONE', 'MANUAL'));
  END IF;
END $$;

-- Unicidade (um levantamento MANUAL por cliente + planejamento + dia) é garantida pela RPC
-- criar_levantamento_item_manual (SELECT antes do INSERT). Índice para performance na busca.
CREATE INDEX IF NOT EXISTS ix_levantamentos_manual_reuso
  ON public.levantamentos (cliente_id, planejamento_id)
  WHERE (tipo_entrada IS NOT NULL AND UPPER(tipo_entrada) = 'MANUAL') AND planejamento_id IS NOT NULL;

COMMENT ON INDEX public.ix_levantamentos_manual_reuso IS
  'Acelera busca de levantamento MANUAL existente por cliente e planejamento (dia tratado na RPC).';

-- -----------------------------------------------------------------------------
-- 3. CATÁLOGO DE TAGS (reutilizável por manual e drone)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tags_pkey PRIMARY KEY (id),
  CONSTRAINT uix_tags_slug UNIQUE (slug)
);

COMMENT ON TABLE public.tags IS 'Catálogo de tags para classificação de itens (ex.: caixa_dagua_suja, entulho). Usado por manual e drone.';

CREATE TABLE IF NOT EXISTS public.levantamento_item_tags (
  levantamento_item_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT levantamento_item_tags_pkey PRIMARY KEY (levantamento_item_id, tag_id),
  CONSTRAINT fk_levantamento_item_tags_item FOREIGN KEY (levantamento_item_id)
    REFERENCES public.levantamento_itens(id) ON DELETE CASCADE,
  CONSTRAINT fk_levantamento_item_tags_tag FOREIGN KEY (tag_id)
    REFERENCES public.tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_levantamento_item_tags_tag_id
  ON public.levantamento_item_tags(tag_id);

COMMENT ON TABLE public.levantamento_item_tags IS 'Relação N:N entre levantamento_itens e tags.';

-- Seed tags iniciais (idempotente)
INSERT INTO public.tags (slug, label) VALUES
  ('caixa_dagua_suja', 'Caixa d''água suja'),
  ('entulho', 'Entulho'),
  ('lixo_acumulado', 'Lixo acumulado'),
  ('calha_entupida', 'Calha entupida'),
  ('poco', 'Poço'),
  ('outro', 'Outro')
ON CONFLICT (slug) DO NOTHING;

-- RLS para tags (leitura para autenticados que acessam cliente; escrita via RPC ou admin)
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_select" ON public.tags;
CREATE POLICY "tags_select" ON public.tags FOR SELECT TO authenticated USING (true);

ALTER TABLE public.levantamento_item_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "levantamento_item_tags_select" ON public.levantamento_item_tags;
CREATE POLICY "levantamento_item_tags_select" ON public.levantamento_item_tags FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.levantamento_itens li
      JOIN public.levantamentos l ON l.id = li.levantamento_id
      WHERE li.id = levantamento_item_tags.levantamento_item_id
      AND public.usuario_pode_acessar_cliente(l.cliente_id)
    )
  );
DROP POLICY IF EXISTS "levantamento_item_tags_insert" ON public.levantamento_item_tags;
CREATE POLICY "levantamento_item_tags_insert" ON public.levantamento_item_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.levantamento_itens li
      JOIN public.levantamentos l ON l.id = li.levantamento_id
      WHERE li.id = levantamento_item_tags.levantamento_item_id
      AND public.usuario_pode_acessar_cliente(l.cliente_id)
    )
  );
DROP POLICY IF EXISTS "levantamento_item_tags_delete" ON public.levantamento_item_tags;
CREATE POLICY "levantamento_item_tags_delete" ON public.levantamento_item_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.levantamento_itens li
      JOIN public.levantamentos l ON l.id = li.levantamento_id
      WHERE li.id = levantamento_item_tags.levantamento_item_id
      AND public.usuario_pode_acessar_cliente(l.cliente_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 4. FUNÇÃO: Criar levantamento_item manual (reutiliza ou cria levantamento)
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

  -- Usuário: id público (usuarios.id)
  SELECT u.id, u.cliente_id INTO v_usuario_id, v_cliente_id
  FROM usuarios u WHERE u.auth_id = v_auth_id LIMIT 1;
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado em public.usuarios.';
  END IF;

  -- Papel: operador pode criar item manual; admin/supervisor/usuario criam planejamento e ativam
  SELECT LOWER(pu.papel::text) INTO v_papel
  FROM papeis_usuarios pu WHERE pu.usuario_id = v_auth_id LIMIT 1;
  IF v_papel IS NULL OR v_papel NOT IN ('admin', 'supervisor', 'usuario', 'operador') THEN
    RAISE EXCEPTION 'Papel não permitido para criação manual de item. Apenas admin, supervisor, usuario ou operador.';
  END IF;

  -- Planejamento obrigatório e ativo
  IF p_planejamento_id IS NULL THEN
    RAISE EXCEPTION 'planejamento_id é obrigatório.';
  END IF;
  SELECT id, cliente_id, ativo INTO v_planejamento
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

  -- Operador só pode criar para o próprio cliente
  IF v_papel = 'operador' THEN
    IF (SELECT u.cliente_id FROM usuarios u WHERE u.auth_id = v_auth_id LIMIT 1) IS DISTINCT FROM v_cliente_id THEN
      RAISE EXCEPTION 'Operador só pode criar itens para o cliente ao qual está vinculado.';
    END IF;
  ELSE
    IF NOT public.usuario_pode_acessar_cliente(v_cliente_id) THEN
      RAISE EXCEPTION 'Sem permissão para acessar o cliente deste planejamento.';
    END IF;
  END IF;

  -- data_voo obrigatória
  IF p_data_voo IS NULL THEN
    RAISE EXCEPTION 'data_voo é obrigatória.';
  END IF;

  -- Buscar levantamento MANUAL existente para (cliente, planejamento, data_voo)
  SELECT l.id INTO v_levantamento_id
  FROM levantamentos l
  WHERE l.cliente_id = v_cliente_id
    AND l.planejamento_id = p_planejamento_id
    AND (l.data_voo::date) = p_data_voo
    AND l.tipo_entrada IS NOT NULL
    AND UPPER(l.tipo_entrada) = 'MANUAL'
  LIMIT 1;

  -- Se não existir, criar levantamento
  IF v_levantamento_id IS NULL THEN
    INSERT INTO levantamentos (
      cliente_id, usuario_id, planejamento_id, titulo, data_voo, total_itens, tipo_entrada
    ) VALUES (
      v_cliente_id,
      v_usuario_id,
      p_planejamento_id,
      'Levantamento manual ' || to_char(p_data_voo, 'DD/MM/YYYY'),
      p_data_voo,
      0,
      'MANUAL'
    )
    RETURNING id INTO v_levantamento_id;
    v_levantamento_criado := true;
  END IF;

  -- Criar levantamento_item
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

  -- Atualizar total_itens do levantamento
  UPDATE levantamentos
  SET total_itens = (SELECT count(*) FROM levantamento_itens WHERE levantamento_id = v_levantamento_id)
  WHERE id = v_levantamento_id;

  -- Inserir tags (por slug)
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
  'Cria um levantamento_item manual: reutiliza levantamento do mesmo dia ou cria um novo com tipo_entrada MANUAL. Valida planejamento ativo, papel e cliente.';

-- -----------------------------------------------------------------------------
-- 5. Grant execute para authenticated
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.criar_levantamento_item_manual TO authenticated;
