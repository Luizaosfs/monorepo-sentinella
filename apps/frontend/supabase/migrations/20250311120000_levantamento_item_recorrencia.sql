-- =============================================================================
-- Levantamento Item Recorrência
-- Detecta automaticamente focos recorrentes no mesmo local (mesmo endereço
-- ou dentro de 50m) nos últimos 30 dias. Ao detectar recorrência:
--   1. Cria ou atualiza registro em levantamento_item_recorrencia
--   2. Eleva a prioridade do novo item para 'Urgente' (se < Urgente)
--   3. Recalcula sla_horas com a nova prioridade
--   4. Atualiza o sla_operacional criado pelo trigger anterior
--
-- Trigger: trg_levantamento_item_recorrencia (nome > trg_levantamento_item_criar_sla_auto
-- alfabeticamente → dispara depois do SLA, garantindo que o SLA já existe para ser atualizado)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela levantamento_item_recorrencia
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.levantamento_item_recorrencia (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id              uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  -- Referência geográfica do cluster (coordenadas do primeiro item detectado)
  endereco_ref            text,
  latitude_ref            double precision,
  longitude_ref           double precision,
  -- Contagem e rastreabilidade
  total_ocorrencias       int         NOT NULL DEFAULT 1,
  primeira_ocorrencia_id  uuid        REFERENCES public.levantamento_itens(id) ON DELETE SET NULL,
  ultima_ocorrencia_id    uuid        REFERENCES public.levantamento_itens(id) ON DELETE SET NULL,
  primeira_ocorrencia_em  timestamptz NOT NULL,
  ultima_ocorrencia_em    timestamptz NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.levantamento_item_recorrencia IS
  'Clusters de focos recorrentes detectados automaticamente. '
  'Um registro por local (mesmo endereco_curto ou raio de 50m). '
  'Populado pelo trigger trg_levantamento_item_recorrencia.';

COMMENT ON COLUMN public.levantamento_item_recorrencia.endereco_ref IS
  'Endereço de referência do cluster (endereco_curto do primeiro item detectado no local).';

CREATE INDEX IF NOT EXISTS lev_item_recorrencia_cliente_idx
  ON public.levantamento_item_recorrencia (cliente_id, ultima_ocorrencia_em DESC);

CREATE INDEX IF NOT EXISTS lev_item_recorrencia_geo_idx
  ON public.levantamento_item_recorrencia (cliente_id, latitude_ref, longitude_ref)
  WHERE latitude_ref IS NOT NULL AND longitude_ref IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Tabela pivô: itens pertencentes a cada cluster de recorrência
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.levantamento_item_recorrencia_itens (
  recorrencia_id          uuid        NOT NULL
                            REFERENCES public.levantamento_item_recorrencia(id) ON DELETE CASCADE,
  levantamento_item_id    uuid        NOT NULL
                            REFERENCES public.levantamento_itens(id) ON DELETE CASCADE,
  adicionado_em           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recorrencia_id, levantamento_item_id)
);

COMMENT ON TABLE public.levantamento_item_recorrencia_itens IS
  'Relação N:N entre clusters de recorrência e seus itens individuais.';

CREATE INDEX IF NOT EXISTS lev_item_recorrencia_itens_item_idx
  ON public.levantamento_item_recorrencia_itens (levantamento_item_id);

-- -----------------------------------------------------------------------------
-- 3. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.levantamento_item_recorrencia        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levantamento_item_recorrencia_itens  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lev_item_recorrencia_select" ON public.levantamento_item_recorrencia;
CREATE POLICY "lev_item_recorrencia_select" ON public.levantamento_item_recorrencia
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "lev_item_recorrencia_itens_select" ON public.levantamento_item_recorrencia_itens;
CREATE POLICY "lev_item_recorrencia_itens_select" ON public.levantamento_item_recorrencia_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.levantamento_item_recorrencia r
      WHERE r.id = recorrencia_id
        AND public.usuario_pode_acessar_cliente(r.cliente_id)
    )
  );

GRANT SELECT ON public.levantamento_item_recorrencia        TO authenticated;
GRANT SELECT ON public.levantamento_item_recorrencia_itens  TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Função principal: detectar e registrar recorrência
-- Chamada pelo trigger após INSERT em levantamento_itens.
-- Estratégia de detecção (OR):
--   a) mesmo endereco_curto (não nulo) no mesmo cliente
--   b) dentro de 50m (quando coordenadas disponíveis)
-- Janela: últimos 30 dias. Limiar: >= 1 ocorrência anterior (total >= 2).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.detectar_recorrencia_levantamento_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item              RECORD;
  v_cliente_id        uuid;
  v_janela_inicio     timestamptz := now() - interval '30 days';
  v_recorrencia_id    uuid;
  v_total_anteriores  int;
  v_nova_prioridade   text := 'Urgente';
  v_nova_sla_horas    int;
  v_config            jsonb;
BEGIN
  -- Carrega o item inserido com dados do levantamento
  SELECT
    li.*,
    lev.cliente_id AS v_cliente_id
  INTO v_item
  FROM public.levantamento_itens li
  JOIN public.levantamentos lev ON lev.id = li.levantamento_id
  WHERE li.id = p_item_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_cliente_id := v_item.v_cliente_id;

  -- Conta ocorrências anteriores no mesmo local nos últimos 30 dias
  -- (exclui o próprio item recem inserido)
  SELECT COUNT(*)
  INTO v_total_anteriores
  FROM public.levantamento_itens li2
  JOIN public.levantamentos lev2 ON lev2.id = li2.levantamento_id
  WHERE lev2.cliente_id = v_cliente_id
    AND li2.id <> p_item_id
    AND li2.data_hora >= v_janela_inicio
    AND (
      -- (a) mesmo endereço curto
      (
        v_item.endereco_curto IS NOT NULL
        AND li2.endereco_curto IS NOT NULL
        AND li2.endereco_curto = v_item.endereco_curto
      )
      OR
      -- (b) raio de 50m (haversine simplificado, preciso para distâncias < 1km)
      (
        v_item.latitude  IS NOT NULL AND v_item.longitude  IS NOT NULL
        AND li2.latitude IS NOT NULL AND li2.longitude IS NOT NULL
        AND sqrt(
          power((li2.latitude  - v_item.latitude)  * 111320.0, 2) +
          power((li2.longitude - v_item.longitude) * 111320.0 * cos(radians(v_item.latitude)), 2)
        ) <= 50.0
      )
    );

  -- Sem recorrência: nada a fazer
  IF v_total_anteriores < 1 THEN
    RETURN;
  END IF;

  -- ── Recorrência detectada ───────────────────────────────────────────────────

  -- 1. Eleva prioridade para Urgente (não faz downgrade de Crítica)
  IF v_item.prioridade IS DISTINCT FROM 'Crítica'
     AND v_item.prioridade IS DISTINCT FROM 'Urgente' THEN

    -- Calcula novo sla_horas com a nova prioridade
    SELECT c.config INTO v_config
    FROM public.sla_config c
    WHERE c.cliente_id = v_cliente_id
    LIMIT 1;

    v_nova_sla_horas := public.sla_horas_from_config(v_config, v_nova_prioridade);
    v_nova_sla_horas := COALESCE(v_nova_sla_horas, 4); -- fallback: 4h para Urgente

    -- Atualiza o item
    UPDATE public.levantamento_itens
    SET
      prioridade  = v_nova_prioridade,
      sla_horas   = v_nova_sla_horas
    WHERE id = p_item_id;

    -- Atualiza o sla_operacional criado pelo trigger anterior
    UPDATE public.sla_operacional
    SET
      prioridade  = v_nova_prioridade,
      sla_horas   = v_nova_sla_horas,
      prazo_final = inicio + (v_nova_sla_horas || ' hours')::interval
    WHERE levantamento_item_id = p_item_id
      AND status IN ('pendente', 'em_atendimento');
  END IF;

  -- 2. Localiza cluster de recorrência existente para este local
  SELECT r.id INTO v_recorrencia_id
  FROM public.levantamento_item_recorrencia r
  WHERE r.cliente_id = v_cliente_id
    AND (
      (
        v_item.endereco_curto IS NOT NULL
        AND r.endereco_ref IS NOT NULL
        AND r.endereco_ref = v_item.endereco_curto
      )
      OR
      (
        v_item.latitude  IS NOT NULL AND v_item.longitude  IS NOT NULL
        AND r.latitude_ref IS NOT NULL AND r.longitude_ref IS NOT NULL
        AND sqrt(
          power((r.latitude_ref  - v_item.latitude)  * 111320.0, 2) +
          power((r.longitude_ref - v_item.longitude) * 111320.0 * cos(radians(v_item.latitude)), 2)
        ) <= 50.0
      )
    )
  ORDER BY r.ultima_ocorrencia_em DESC
  LIMIT 1;

  IF v_recorrencia_id IS NULL THEN
    -- 3a. Cria novo cluster
    INSERT INTO public.levantamento_item_recorrencia (
      cliente_id,
      endereco_ref,
      latitude_ref,
      longitude_ref,
      total_ocorrencias,
      primeira_ocorrencia_id,
      ultima_ocorrencia_id,
      primeira_ocorrencia_em,
      ultima_ocorrencia_em
    )
    VALUES (
      v_cliente_id,
      v_item.endereco_curto,
      v_item.latitude,
      v_item.longitude,
      v_total_anteriores + 1,
      p_item_id,       -- referência ao item atual como âncora do cluster
      p_item_id,
      COALESCE(v_item.data_hora, now()),
      COALESCE(v_item.data_hora, now())
    )
    RETURNING id INTO v_recorrencia_id;
  ELSE
    -- 3b. Atualiza cluster existente
    UPDATE public.levantamento_item_recorrencia
    SET
      total_ocorrencias    = total_ocorrencias + 1,
      ultima_ocorrencia_id = p_item_id,
      ultima_ocorrencia_em = COALESCE(v_item.data_hora, now()),
      updated_at           = now()
    WHERE id = v_recorrencia_id;
  END IF;

  -- 4. Vincula item ao cluster
  INSERT INTO public.levantamento_item_recorrencia_itens (recorrencia_id, levantamento_item_id)
  VALUES (v_recorrencia_id, p_item_id)
  ON CONFLICT DO NOTHING;

END;
$$;

COMMENT ON FUNCTION public.detectar_recorrencia_levantamento_item(uuid) IS
  'Detecta recorrência de foco no mesmo local (endereco_curto idêntico ou raio 50m) '
  'nos últimos 30 dias. Se >= 1 ocorrência anterior: '
  '(1) eleva prioridade para Urgente se < Urgente, '
  '(2) recalcula sla_horas e prazo_final no sla_operacional, '
  '(3) cria/atualiza cluster em levantamento_item_recorrencia.';

-- -----------------------------------------------------------------------------
-- 5. Trigger em levantamento_itens
-- Nome começa com "trg_levantamento_item_r" > "trg_levantamento_item_c"
-- → dispara DEPOIS de trg_levantamento_item_criar_sla_auto (ordem alfabética).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_levantamento_item_recorrencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.detectar_recorrencia_levantamento_item(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_levantamento_item_recorrencia ON public.levantamento_itens;

CREATE TRIGGER trg_levantamento_item_recorrencia
  AFTER INSERT ON public.levantamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_levantamento_item_recorrencia();

-- -----------------------------------------------------------------------------
-- 6. View para consulta eficiente no frontend
-- Expõe clusters ativos (com ocorrência nos últimos 30 dias) com contagem.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_recorrencias_ativas AS
SELECT
  r.id,
  r.cliente_id,
  r.endereco_ref,
  r.latitude_ref,
  r.longitude_ref,
  r.total_ocorrencias,
  r.primeira_ocorrencia_id,
  r.ultima_ocorrencia_id,
  r.primeira_ocorrencia_em,
  r.ultima_ocorrencia_em,
  -- Último item para exibição rápida
  li.item             AS ultimo_item,
  li.risco            AS ultimo_risco,
  li.prioridade       AS ultima_prioridade,
  li.endereco_curto   AS ultimo_endereco_curto,
  li.image_url        AS ultima_image_url
FROM public.levantamento_item_recorrencia r
LEFT JOIN public.levantamento_itens li ON li.id = r.ultima_ocorrencia_id
WHERE r.ultima_ocorrencia_em >= now() - interval '30 days';

COMMENT ON VIEW public.v_recorrencias_ativas IS
  'Clusters de recorrência com ao menos uma ocorrência nos últimos 30 dias. '
  'Inclui dados do item mais recente para exibição no dashboard.';

GRANT SELECT ON public.v_recorrencias_ativas TO authenticated;
