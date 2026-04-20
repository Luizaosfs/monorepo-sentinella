-- QW-10B: Governança de arquivos, órfãos e retenção de imagens
--
-- Problema: public_id do Cloudinary nunca é persistido → arquivos tornam-se
--           órfãos permanentes quando registros são soft-deleted ou removidos.
--
-- Correção 1 — Colunas public_id nas tabelas que armazenam URLs de arquivo
-- Correção 2 — Tabela cloudinary_orfaos: fila de limpeza segura com retenção
-- Correção 3 — Trigger: soft delete de levantamento_itens → popula cloudinary_orfaos
-- Correção 4 — Trigger: DELETE em vistorias → popula cloudinary_orfaos
-- Correção 5 — Atualiza RPC criar_levantamento_item_manual com p_image_public_id
-- Correção 6 — Atualiza RPC denunciar_cidadao com p_foto_public_id

-- ── Correção 1: Colunas public_id ────────────────────────────────────────────

ALTER TABLE public.levantamento_itens
  ADD COLUMN IF NOT EXISTS image_public_id text;

COMMENT ON COLUMN public.levantamento_itens.image_public_id IS
  'Cloudinary public_id da imagem principal do item. Necessário para exclusão segura. (QW-10B)';

ALTER TABLE public.vistorias
  ADD COLUMN IF NOT EXISTS assinatura_public_id   text,
  ADD COLUMN IF NOT EXISTS foto_externa_public_id text;

COMMENT ON COLUMN public.vistorias.assinatura_public_id IS
  'Cloudinary public_id da assinatura digital do responsável. (QW-10B)';
COMMENT ON COLUMN public.vistorias.foto_externa_public_id IS
  'Cloudinary public_id da foto externa (fluxo sem acesso). (QW-10B)';

ALTER TABLE public.vistoria_calhas
  ADD COLUMN IF NOT EXISTS foto_public_id text;

COMMENT ON COLUMN public.vistoria_calhas.foto_public_id IS
  'Cloudinary public_id da foto da calha. (QW-10B)';

ALTER TABLE public.levantamento_item_evidencias
  ADD COLUMN IF NOT EXISTS public_id text;

COMMENT ON COLUMN public.levantamento_item_evidencias.public_id IS
  'Cloudinary public_id da evidência. Permite exclusão do arquivo ao remover o registro. (QW-10B)';

ALTER TABLE public.operacao_evidencias
  ADD COLUMN IF NOT EXISTS public_id text;

COMMENT ON COLUMN public.operacao_evidencias.public_id IS
  'Cloudinary public_id da evidência operacional. (QW-10B)';

-- ── Correção 2: Tabela cloudinary_orfaos ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cloudinary_orfaos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id       text        NOT NULL,
  url             text,
  origem_tabela   text        NOT NULL,
  origem_id       uuid,
  cliente_id      uuid        REFERENCES public.clientes(id) ON DELETE CASCADE,
  motivo          text        NOT NULL DEFAULT 'soft_delete',
  -- Retenção: 5 anos para evidências de saúde pública; ajustável por Edge Function
  retention_until timestamptz NOT NULL DEFAULT now() + interval '5 years',
  processado_em   timestamptz,
  deletado_em     timestamptz,
  erro            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cloudinary_orfaos IS
  'Fila de arquivos Cloudinary elegíveis para exclusão futura. '
  'Populada por triggers de soft delete / DELETE. '
  'Edge Function cloudinary-cleanup-orfaos processa registros com retention_until < now(). '
  'NUNCA deletar diretamente — sempre via Edge Function com dry_run=true primeiro. (QW-10B)';

CREATE INDEX IF NOT EXISTS idx_cloudinary_orfaos_pendentes
  ON public.cloudinary_orfaos (retention_until)
  WHERE processado_em IS NULL AND deletado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_cloudinary_orfaos_cliente
  ON public.cloudinary_orfaos (cliente_id);

ALTER TABLE public.cloudinary_orfaos ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode ver a fila de órfãos
CREATE POLICY "orfaos_admin_only" ON public.cloudinary_orfaos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      JOIN public.papeis_usuarios pu ON pu.usuario_id = u.auth_id
      WHERE u.auth_id = auth.uid()
        AND LOWER(pu.papel::text) = 'admin'
    )
  );

-- ── Correção 3: Trigger — soft delete de levantamento_itens ──────────────────

CREATE OR REPLACE FUNCTION fn_orfaos_levantamento_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cliente_id uuid;
BEGIN
  -- Dispara apenas quando deleted_at muda de NULL para não-NULL
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN

    -- Resolve cliente_id via levantamento
    SELECT l.cliente_id INTO v_cliente_id
    FROM public.levantamentos l
    WHERE l.id = NEW.levantamento_id
    LIMIT 1;

    -- Imagem principal
    IF NEW.image_public_id IS NOT NULL THEN
      INSERT INTO public.cloudinary_orfaos
        (public_id, url, origem_tabela, origem_id, cliente_id, motivo)
      VALUES
        (NEW.image_public_id, NEW.image_url, 'levantamento_itens', NEW.id, v_cliente_id, 'soft_delete');
    END IF;

    -- Evidências vinculadas ao item
    INSERT INTO public.cloudinary_orfaos
      (public_id, url, origem_tabela, origem_id, cliente_id, motivo)
    SELECT
      lie.public_id,
      lie.image_url,
      'levantamento_item_evidencias',
      lie.id,
      v_cliente_id,
      'soft_delete_cascade'
    FROM public.levantamento_item_evidencias lie
    WHERE lie.levantamento_item_id = NEW.id
      AND lie.public_id IS NOT NULL;

  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_orfaos_levantamento_item IS
  'Popula cloudinary_orfaos quando levantamento_itens é soft-deleted. '
  'Inclui imagem principal (image_public_id) e evidências vinculadas. (QW-10B)';

DROP TRIGGER IF EXISTS trg_orfaos_levantamento_item ON public.levantamento_itens;
CREATE TRIGGER trg_orfaos_levantamento_item
  AFTER UPDATE OF deleted_at ON public.levantamento_itens
  FOR EACH ROW EXECUTE FUNCTION fn_orfaos_levantamento_item();

-- ── Correção 4: Trigger — DELETE físico em vistorias ─────────────────────────

CREATE OR REPLACE FUNCTION fn_orfaos_vistoria()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Assinatura
  IF OLD.assinatura_public_id IS NOT NULL THEN
    INSERT INTO public.cloudinary_orfaos
      (public_id, url, origem_tabela, origem_id, cliente_id, motivo)
    VALUES
      (OLD.assinatura_public_id, OLD.assinatura_responsavel_url,
       'vistorias', OLD.id, OLD.cliente_id, 'delete_fisico');
  END IF;

  -- Foto externa (sem acesso)
  IF OLD.foto_externa_public_id IS NOT NULL THEN
    INSERT INTO public.cloudinary_orfaos
      (public_id, url, origem_tabela, origem_id, cliente_id, motivo)
    VALUES
      (OLD.foto_externa_public_id, OLD.foto_externa_url,
       'vistorias', OLD.id, OLD.cliente_id, 'delete_fisico');
  END IF;

  -- Fotos de calhas vinculadas
  INSERT INTO public.cloudinary_orfaos
    (public_id, url, origem_tabela, origem_id, cliente_id, motivo)
  SELECT
    vc.foto_public_id,
    vc.foto_url,
    'vistoria_calhas',
    vc.id,
    OLD.cliente_id,
    'delete_fisico_cascade'
  FROM public.vistoria_calhas vc
  WHERE vc.vistoria_id = OLD.id
    AND vc.foto_public_id IS NOT NULL;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION fn_orfaos_vistoria IS
  'Captura public_ids antes de DELETE físico em vistorias. '
  'Inclui assinatura, foto_externa e fotos de calhas. (QW-10B)';

DROP TRIGGER IF EXISTS trg_orfaos_vistoria ON public.vistorias;
CREATE TRIGGER trg_orfaos_vistoria
  BEFORE DELETE ON public.vistorias
  FOR EACH ROW EXECUTE FUNCTION fn_orfaos_vistoria();

-- ── Correção 5: Atualizar RPC criar_levantamento_item_manual ─────────────────

DROP FUNCTION IF EXISTS public.criar_levantamento_item_manual(
  uuid, date,
  double precision, double precision,
  text, text, text, double precision, text, integer,
  text, text, text, text, text,
  timestamptz, text[], double precision, jsonb
);

CREATE FUNCTION public.criar_levantamento_item_manual(
  p_planejamento_id     uuid,
  p_data_voo            date,
  p_latitude            double precision  DEFAULT NULL,
  p_longitude           double precision  DEFAULT NULL,
  p_item                text              DEFAULT NULL,
  p_risco               text              DEFAULT NULL,
  p_acao                text              DEFAULT NULL,
  p_score_final         double precision  DEFAULT NULL,
  p_prioridade          text              DEFAULT NULL,
  p_sla_horas           integer           DEFAULT NULL,
  p_endereco_curto      text              DEFAULT NULL,
  p_endereco_completo   text              DEFAULT NULL,
  p_image_url           text              DEFAULT NULL,
  p_maps                text              DEFAULT NULL,
  p_waze                text              DEFAULT NULL,
  p_data_hora           timestamptz       DEFAULT NULL,
  p_tags                text[]            DEFAULT NULL,
  p_peso                double precision  DEFAULT NULL,
  p_payload             jsonb             DEFAULT NULL,
  p_image_public_id     text              DEFAULT NULL
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

  SELECT LOWER(pu.papel::text) INTO v_papel
  FROM papeis_usuarios pu WHERE pu.usuario_id = v_auth_id LIMIT 1;
  IF v_papel IS NULL OR v_papel NOT IN ('admin', 'supervisor', 'usuario', 'operador') THEN
    RAISE EXCEPTION 'Papel não permitido para criação manual de item.';
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

  IF v_papel = 'operador' THEN
    IF (SELECT u.cliente_id FROM usuarios u WHERE u.auth_id = v_auth_id LIMIT 1) IS DISTINCT FROM v_cliente_id THEN
      RAISE EXCEPTION 'Operador só pode criar itens para o próprio cliente.';
    END IF;
  ELSE
    IF NOT public.usuario_pode_acessar_cliente(v_cliente_id) THEN
      RAISE EXCEPTION 'Sem permissão para acessar o cliente deste planejamento.';
    END IF;
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
    levantamento_id,
    latitude, longitude, item, risco, peso, acao, score_final, prioridade, sla_horas,
    endereco_curto, endereco_completo, image_url, image_public_id,
    maps, waze, data_hora, payload
  ) VALUES (
    v_levantamento_id,
    p_latitude, p_longitude, p_item, p_risco, p_peso, p_acao, p_score_final, p_prioridade, p_sla_horas,
    p_endereco_curto, p_endereco_completo, p_image_url, p_image_public_id,
    p_maps, p_waze,
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
  'Cria levantamento_item manual com suporte a image_public_id para rastreabilidade Cloudinary. (QW-10B)';

GRANT EXECUTE ON FUNCTION public.criar_levantamento_item_manual TO authenticated;

-- ── Correção 6: Atualizar RPC denunciar_cidadao ───────────────────────────────

DROP FUNCTION IF EXISTS public.denunciar_cidadao(text, uuid, text, double precision, double precision, text);

CREATE FUNCTION public.denunciar_cidadao(
  p_slug          text,
  p_bairro_id     uuid,
  p_descricao     text,
  p_latitude      double precision DEFAULT NULL,
  p_longitude     double precision DEFAULT NULL,
  p_foto_url      text             DEFAULT NULL,
  p_foto_public_id text            DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id  uuid;
  v_lev_id      uuid;
  v_item_id     uuid;
  v_rate_total  integer;
  v_raio_m      constant numeric := 30;
  v_janela_min  constant integer := 30;
  v_limite      constant integer := 5;
BEGIN
  SELECT id INTO v_cliente_id FROM clientes WHERE slug = p_slug AND ativo = true;
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    SELECT COALESCE(SUM(total), 0) INTO v_rate_total
    FROM canal_cidadao_rate_limit
    WHERE cliente_id = v_cliente_id
      AND ABS(latitude  - p_latitude)  < 0.0003
      AND ABS(longitude - p_longitude) < 0.0003
      AND janela_inicio > now() - (v_janela_min || ' minutes')::interval;

    IF v_rate_total >= v_limite THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Muitas denúncias registradas neste local. Aguarde ' || v_janela_min || ' minutos.'
      );
    END IF;

    INSERT INTO canal_cidadao_rate_limit (cliente_id, latitude, longitude, janela_inicio)
    VALUES (v_cliente_id, p_latitude, p_longitude, date_trunc('minute', now()))
    ON CONFLICT DO NOTHING;

    UPDATE canal_cidadao_rate_limit
    SET total = total + 1, ultima_em = now()
    WHERE cliente_id = v_cliente_id
      AND ABS(latitude  - p_latitude)  < 0.0003
      AND ABS(longitude - p_longitude) < 0.0003
      AND janela_inicio = date_trunc('minute', now());
  END IF;

  -- Deduplicação por localização
  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    SELECT li.id INTO v_item_id
    FROM levantamento_itens li
    JOIN levantamentos l ON l.id = li.levantamento_id
    WHERE l.cliente_id = v_cliente_id
      AND li.item = 'Denúncia Cidadão'
      AND li.created_at > now() - interval '24 hours'
      AND li.latitude IS NOT NULL
      AND li.longitude IS NOT NULL
      AND ST_DWithin(
        ST_MakePoint(p_longitude, p_latitude)::geography,
        ST_MakePoint(li.longitude, li.latitude)::geography,
        v_raio_m
      )
    ORDER BY li.created_at DESC
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE levantamento_itens
      SET payload = jsonb_set(
        COALESCE(payload, '{}'::jsonb),
        '{confirmacoes}',
        (COALESCE((payload->>'confirmacoes')::int, 1) + 1)::text::jsonb
      )
      WHERE id = v_item_id;

      RETURN jsonb_build_object(
        'ok', true, 'item_id', v_item_id::text,
        'deduplicado', true,
        'mensagem', 'Denúncia registrada. Este local já foi reportado — sua confirmação foi contabilizada.'
      );
    END IF;
  END IF;

  SELECT id INTO v_lev_id
  FROM levantamentos
  WHERE cliente_id = v_cliente_id
    AND tipo_entrada = 'MANUAL'
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

  INSERT INTO levantamento_itens (
    levantamento_id, item, risco, prioridade,
    latitude, longitude, endereco_curto,
    image_url, image_public_id,
    payload, status_atendimento
  ) VALUES (
    v_lev_id, 'Denúncia Cidadão', 'Médio', 'Média',
    p_latitude, p_longitude,
    p_descricao,
    p_foto_url, p_foto_public_id,
    jsonb_build_object(
      'fonte',              'cidadao',
      'bairro_id',          p_bairro_id::text,
      'descricao_original', p_descricao,
      'foto_url',           p_foto_url,
      'confirmacoes',       1
    ),
    'pendente'
  )
  RETURNING id INTO v_item_id;

  UPDATE levantamentos SET total_itens = total_itens + 1 WHERE id = v_lev_id;

  RETURN jsonb_build_object('ok', true, 'item_id', v_item_id::text, 'deduplicado', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text) TO authenticated;
