-- =============================================================================
-- SLA config por região
--
-- Permite que cada região dentro de um cliente tenha sua própria configuração
-- de SLA, sobrescrevendo o config cliente-wide.
--
-- Resolução: sla_config_regiao (regiao) → sla_config (cliente) → hardcoded default
--
-- Impacto nos triggers existentes:
--   trg_levantamento_item_criar_sla_auto — resolve regiao via planejamento
--   escalar_sla_operacional              — usa sla_resolve_config com regiao
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. planejamento.regiao_id — pré-requisito para resolução de config por região
-- -----------------------------------------------------------------------------
ALTER TABLE public.planejamento
  ADD COLUMN IF NOT EXISTS regiao_id uuid REFERENCES public.regioes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS planejamento_regiao_id_idx
  ON public.planejamento (regiao_id)
  WHERE regiao_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 1. Tabela sla_config_regiao
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sla_config_regiao (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  regiao_id  uuid NOT NULL REFERENCES public.regioes(id)  ON DELETE CASCADE,
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, regiao_id)
);

CREATE INDEX IF NOT EXISTS sla_config_regiao_cliente_idx
  ON public.sla_config_regiao (cliente_id);
CREATE INDEX IF NOT EXISTS sla_config_regiao_regiao_idx
  ON public.sla_config_regiao (regiao_id);

COMMENT ON TABLE public.sla_config_regiao IS
  'Configuração de SLA por região. Sobrescreve sla_config (cliente-wide) quando presente. '
  'Usa mesmo formato de config jsonb que sla_config.';

-- updated_at auto-update
CREATE OR REPLACE FUNCTION public.trg_sla_config_regiao_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_sla_config_regiao_updated_at ON public.sla_config_regiao;
CREATE TRIGGER trg_sla_config_regiao_updated_at
  BEFORE UPDATE ON public.sla_config_regiao
  FOR EACH ROW EXECUTE FUNCTION public.trg_sla_config_regiao_updated_at();

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.sla_config_regiao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_config_regiao_select" ON public.sla_config_regiao
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "sla_config_regiao_insert" ON public.sla_config_regiao
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "sla_config_regiao_update" ON public.sla_config_regiao
  FOR UPDATE TO authenticated
  USING  (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "sla_config_regiao_delete" ON public.sla_config_regiao
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- -----------------------------------------------------------------------------
-- 3. Resolver de config efetivo
--    Resolução: sla_config_regiao → sla_config → NULL
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sla_resolve_config(
  p_cliente_id uuid,
  p_regiao_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
BEGIN
  -- 1. Config por região (se fornecida)
  IF p_regiao_id IS NOT NULL THEN
    SELECT config INTO v_config
    FROM public.sla_config_regiao
    WHERE cliente_id = p_cliente_id
      AND regiao_id  = p_regiao_id
    LIMIT 1;

    IF FOUND AND v_config IS NOT NULL THEN
      RETURN v_config;
    END IF;
  END IF;

  -- 2. Config cliente-wide
  SELECT config INTO v_config
  FROM public.sla_config
  WHERE cliente_id = p_cliente_id
  LIMIT 1;

  RETURN v_config;  -- pode ser NULL (funções downstream tratam isso)
END;
$$;

COMMENT ON FUNCTION public.sla_resolve_config(uuid, uuid) IS
  'Retorna a config de SLA efetiva para o cliente+região. '
  'Prioridade: sla_config_regiao > sla_config (cliente-wide). '
  'Retorna NULL se nenhuma config estiver cadastrada.';

GRANT EXECUTE ON FUNCTION public.sla_resolve_config(uuid, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Função auxiliar: resolve regiao_id de um levantamento_item
--    (levantamento_itens → levantamentos → planejamento → regiao_id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sla_regiao_do_item(p_item_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.regiao_id
  FROM levantamento_itens li
  JOIN levantamentos l      ON l.id = li.levantamento_id
  JOIN planejamento  p      ON p.id = l.planejamento_id
  WHERE li.id = p_item_id
  LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- 5. Atualiza trg_levantamento_item_criar_sla_auto para usar sla_resolve_config
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_levantamento_item_criar_sla_auto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_regiao_id  uuid;
  v_config     jsonb;
  v_horas      int;
  v_inicio     timestamptz;
BEGIN
  -- Idempotência
  IF EXISTS (
    SELECT 1 FROM public.sla_operacional
    WHERE levantamento_item_id = NEW.id
      AND status IN ('pendente', 'em_atendimento')
  ) THEN
    RETURN NEW;
  END IF;

  -- Resolve cliente e região via levantamento → planejamento
  SELECT l.cliente_id, p.regiao_id
  INTO   v_cliente_id, v_regiao_id
  FROM   public.levantamentos l
  JOIN   public.planejamento  p ON p.id = l.planejamento_id
  WHERE  l.id = NEW.levantamento_id;

  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se sla_horas já calculado pela API, usa diretamente
  IF NEW.sla_horas IS NOT NULL AND NEW.sla_horas >= 1 THEN
    v_horas := NEW.sla_horas;
  ELSE
    -- Resolve config: região → cliente
    v_config := public.sla_resolve_config(v_cliente_id, v_regiao_id);
    v_horas  := COALESCE(
      public.sla_horas_from_config(v_config, COALESCE(NEW.prioridade, 'Média')),
      24
    );
  END IF;

  v_inicio := now();

  INSERT INTO public.sla_operacional (
    levantamento_item_id, cliente_id, prioridade, sla_horas, inicio, prazo_final, status
  ) VALUES (
    NEW.id,
    v_cliente_id,
    COALESCE(NEW.prioridade, 'Média'),
    v_horas,
    v_inicio,
    public.sla_calcular_prazo_final(
      v_inicio, v_horas,
      public.sla_resolve_config(v_cliente_id, v_regiao_id),
      v_cliente_id
    ),
    'pendente'
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_levantamento_item_criar_sla_auto() IS
  'Trigger AFTER INSERT em levantamento_itens: cria SLA automático. '
  'Usa sla_resolve_config(cliente, regiao) para buscar config efetiva — '
  'respeita override por região quando cadastrado.';

DROP TRIGGER IF EXISTS trg_after_insert_levantamento_item_sla ON public.levantamento_itens;
CREATE TRIGGER trg_after_insert_levantamento_item_sla
  AFTER INSERT ON public.levantamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_levantamento_item_criar_sla_auto();

-- -----------------------------------------------------------------------------
-- 6. Atualiza escalar_sla_operacional para resolver config por região
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.escalar_sla_operacional(p_sla_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla         public.sla_operacional%ROWTYPE;
  v_nova_prio   text;
  v_config      jsonb;
  v_horas_base  int;
  v_horas_final int;
  v_item_pluvio public.pluvio_operacional_item%ROWTYPE;
  v_regiao_id   uuid;
  v_agora       timestamptz := now();
BEGIN
  SELECT * INTO v_sla FROM public.sla_operacional WHERE id = p_sla_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLA não encontrado: %', p_sla_id;
  END IF;

  IF v_sla.status = 'concluido' THEN
    RAISE EXCEPTION 'SLA já concluído; não é possível escalar.';
  END IF;

  v_nova_prio := public.escalar_prioridade(v_sla.prioridade);

  IF lower(trim(v_nova_prio)) = lower(trim(v_sla.prioridade)) THEN
    RETURN jsonb_build_object(
      'escalado', false,
      'mensagem', 'Prioridade já está no nível máximo (' || v_sla.prioridade || ').'
    );
  END IF;

  -- Resolve região do item de levantamento (para usar config correta)
  IF v_sla.levantamento_item_id IS NOT NULL THEN
    v_regiao_id := public.sla_regiao_do_item(v_sla.levantamento_item_id);
  END IF;

  v_config     := public.sla_resolve_config(v_sla.cliente_id, v_regiao_id);
  v_horas_base := public.sla_horas_from_config(v_config, v_nova_prio);

  -- Fatores ambientais apenas para itens pluviométricos
  IF v_sla.item_id IS NOT NULL THEN
    SELECT * INTO v_item_pluvio
    FROM public.pluvio_operacional_item
    WHERE id = v_sla.item_id;

    v_horas_final := public.sla_aplicar_fatores(
      v_horas_base, v_config,
      v_item_pluvio.classificacao_risco,
      v_item_pluvio.persistencia_7d,
      v_item_pluvio.temp_media_c
    );
  ELSE
    v_horas_final := v_horas_base;
  END IF;

  UPDATE public.sla_operacional
  SET
    prioridade_original = COALESCE(prioridade_original, prioridade),
    prioridade          = v_nova_prio,
    sla_horas           = v_horas_final,
    inicio              = v_agora,
    prazo_final         = v_agora + (v_horas_final || ' hours')::interval,
    escalonado          = true,
    escalonado_em       = v_agora,
    status              = CASE WHEN status = 'vencido' THEN 'pendente' ELSE status END,
    violado             = CASE WHEN status = 'vencido' THEN violado    ELSE violado END
  WHERE id = p_sla_id;

  RETURN jsonb_build_object(
    'escalado',            true,
    'prioridade_anterior', v_sla.prioridade,
    'prioridade_nova',     v_nova_prio,
    'sla_horas',           v_horas_final,
    'regiao_override',     v_regiao_id IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.escalar_sla_operacional(uuid) TO authenticated;

COMMENT ON FUNCTION public.escalar_sla_operacional(uuid) IS
  'Escala um SLA para a próxima prioridade e recalcula prazo. '
  'Usa sla_resolve_config para respeitar override de região quando cadastrado.';

-- -----------------------------------------------------------------------------
-- 7. Atualiza criar_levantamento_item_manual para usar sla_resolve_config
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_levantamento_item_manual(
  p_planejamento_id    uuid,
  p_data_voo           date,
  p_latitude           double precision DEFAULT NULL,
  p_longitude          double precision DEFAULT NULL,
  p_item               text  DEFAULT NULL,
  p_risco              text  DEFAULT NULL,
  p_acao               text  DEFAULT NULL,
  p_score_final        double precision DEFAULT NULL,
  p_prioridade         text  DEFAULT NULL,
  p_sla_horas          integer DEFAULT NULL,
  p_endereco_curto     text  DEFAULT NULL,
  p_endereco_completo  text  DEFAULT NULL,
  p_image_url          text  DEFAULT NULL,
  p_maps               text  DEFAULT NULL,
  p_waze               text  DEFAULT NULL,
  p_data_hora          timestamptz DEFAULT NULL,
  p_tags               text[] DEFAULT NULL,
  p_peso               double precision DEFAULT NULL,
  p_payload            jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id           uuid;
  v_usuario_id        uuid;
  v_cliente_id        uuid;
  v_planejamento      RECORD;
  v_tipo_entrada      text;
  v_levantamento_id   uuid;
  v_levantamento_criado boolean := false;
  v_item_id           uuid;
  v_tag_slug          text;
  v_tag_id            uuid;
  v_papel             text;
  v_sla_horas         integer;
  v_config            jsonb;
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
  SELECT id, cliente_id, ativo, tipo_levantamento, regiao_id
  INTO v_planejamento
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

  -- Resolve config efetiva: regiao → cliente
  IF p_sla_horas IS NOT NULL AND p_sla_horas >= 1 THEN
    v_sla_horas := p_sla_horas;
  ELSE
    v_config    := public.sla_resolve_config(v_cliente_id, v_planejamento.regiao_id);
    v_sla_horas := COALESCE(
      public.sla_horas_from_config(v_config, COALESCE(NULLIF(trim(p_prioridade), ''), 'Média')),
      24
    );
  END IF;

  -- Busca ou cria levantamento
  SELECT l.id INTO v_levantamento_id
  FROM levantamentos l
  WHERE l.cliente_id     = v_cliente_id
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
        v_cliente_id, v_usuario_id, p_planejamento_id,
        'Levantamento ' || LOWER(v_tipo_entrada) || ' ' || to_char(p_data_voo, 'DD/MM/YYYY'),
        p_data_voo, 0, v_tipo_entrada
      )
      RETURNING id INTO v_levantamento_id;
      v_levantamento_criado := true;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT l.id INTO v_levantamento_id
        FROM levantamentos l
        WHERE l.cliente_id     = v_cliente_id
          AND l.planejamento_id = p_planejamento_id
          AND (l.data_voo::date) = p_data_voo
          AND l.tipo_entrada IS NOT NULL
          AND UPPER(TRIM(l.tipo_entrada)) = v_tipo_entrada
        LIMIT 1;
        IF v_levantamento_id IS NULL THEN RAISE; END IF;
    END;
  END IF;

  INSERT INTO levantamento_itens (
    levantamento_id,
    latitude, longitude, item, risco, peso, acao, score_final, prioridade, sla_horas,
    endereco_curto, endereco_completo, image_url, maps, waze, data_hora, payload
  ) VALUES (
    v_levantamento_id,
    p_latitude, p_longitude, p_item, p_risco, p_peso, p_acao, p_score_final, p_prioridade, v_sla_horas,
    p_endereco_curto, p_endereco_completo, p_image_url, p_maps, p_waze,
    COALESCE(p_data_hora, now()), p_payload
  )
  RETURNING id INTO v_item_id;

  UPDATE levantamentos
  SET total_itens = (SELECT count(*) FROM levantamento_itens WHERE levantamento_id = v_levantamento_id)
  WHERE id = v_levantamento_id;

  IF p_tags IS NOT NULL AND array_length(p_tags, 1) > 0 THEN
    FOREACH v_tag_slug IN ARRAY p_tags LOOP
      SELECT id INTO v_tag_id FROM tags WHERE slug = v_tag_slug LIMIT 1;
      IF v_tag_id IS NOT NULL THEN
        INSERT INTO levantamento_item_tags (levantamento_item_id, tag_id)
        VALUES (v_item_id, v_tag_id)
        ON CONFLICT (levantamento_item_id, tag_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'levantamento_item',   (SELECT to_jsonb(li.*) FROM levantamento_itens li WHERE li.id = v_item_id),
    'levantamento_criado', v_levantamento_criado,
    'levantamento_id',     v_levantamento_id
  );
END;
$$;

COMMENT ON FUNCTION public.criar_levantamento_item_manual IS
  'Cria levantamento_item com 1 levantamento por (cliente, planejamento, data, tipo). '
  'Usa sla_resolve_config(cliente, regiao) — respeita override de região quando cadastrado.';
