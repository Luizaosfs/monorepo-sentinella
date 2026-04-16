-- =============================================================================
-- SLA: suporte a levantamento_itens (drone / manual)
--
-- Estratégia: adicionar cliente_id diretamente em sla_operacional (denorm)
-- e levantamento_item_id como segunda FK (mutuamente exclusiva com item_id).
--
-- 1. Novos campos em sla_operacional
-- 2. Backfill de cliente_id nos registros pluvio existentes
-- 3. RLS simplificado via cliente_id direto
-- 4. Atualiza triggers pluvio existentes para preencher cliente_id
-- 5. Trigger AFTER INSERT em levantamento_itens → SLA automático
-- 6. Atualiza operacoes trigger (fecha SLA por item_levantamento_id)
-- 7. Atualiza marcar_slas_vencidos (usa cliente_id direto)
-- 8. Atualiza escalar_sla_operacional (suporta levantamento)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Novos campos em sla_operacional
-- ---------------------------------------------------------------------------
ALTER TABLE public.sla_operacional
  ADD COLUMN IF NOT EXISTS cliente_id          uuid REFERENCES public.clientes(id),
  ADD COLUMN IF NOT EXISTS levantamento_item_id uuid REFERENCES public.levantamento_itens(id);

-- item_id não é mais obrigatório (pode vir de levantamento_itens)
ALTER TABLE public.sla_operacional
  ALTER COLUMN item_id DROP NOT NULL;

-- Exatamente um dos dois FKs deve estar preenchido
ALTER TABLE public.sla_operacional
  DROP CONSTRAINT IF EXISTS sla_operacional_item_exclusivo;
ALTER TABLE public.sla_operacional
  ADD CONSTRAINT sla_operacional_item_exclusivo
  CHECK (num_nonnulls(item_id, levantamento_item_id) = 1);

-- Index para buscas por cliente e por levantamento_item
CREATE INDEX IF NOT EXISTS sla_operacional_cliente_idx
  ON public.sla_operacional (cliente_id, status, prazo_final);
CREATE INDEX IF NOT EXISTS sla_operacional_lev_item_idx
  ON public.sla_operacional (levantamento_item_id)
  WHERE levantamento_item_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Backfill: cliente_id para registros pluvio já existentes
-- ---------------------------------------------------------------------------
UPDATE public.sla_operacional s
SET cliente_id = r.cliente_id
FROM public.pluvio_operacional_item it
JOIN public.pluvio_operacional_run r ON r.id = it.run_id
WHERE s.item_id = it.id
  AND s.cliente_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. RLS — simplificado usando cliente_id direto
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "sla_operacional_select" ON public.sla_operacional;
CREATE POLICY "sla_operacional_select" ON public.sla_operacional
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_operacional_insert" ON public.sla_operacional;
CREATE POLICY "sla_operacional_insert" ON public.sla_operacional
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_operacional_update" ON public.sla_operacional;
CREATE POLICY "sla_operacional_update" ON public.sla_operacional
  FOR UPDATE TO authenticated
  USING  (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_operacional_delete" ON public.sla_operacional;
CREATE POLICY "sla_operacional_delete" ON public.sla_operacional
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- ---------------------------------------------------------------------------
-- 4. Atualiza trigger pluvio: passa a setar cliente_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_pluvio_item_criar_sla_auto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id  uuid;
  v_config      jsonb;
  v_horas_base  int;
  v_horas_final int;
  v_inicio      timestamptz;
BEGIN
  -- Idempotência: não cria se já existe SLA aberto para este item
  IF EXISTS (
    SELECT 1 FROM public.sla_operacional
    WHERE item_id = NEW.id
      AND status IN ('pendente', 'em_atendimento')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT r.cliente_id INTO v_cliente_id
  FROM public.pluvio_operacional_run r
  WHERE r.id = NEW.run_id;

  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.config INTO v_config
  FROM public.sla_config c
  WHERE c.cliente_id = v_cliente_id
  LIMIT 1;

  v_inicio := now();
  v_horas_base  := public.sla_horas_from_config(v_config, NEW.prioridade_operacional);
  v_horas_final := public.sla_aplicar_fatores(
    v_horas_base, v_config,
    NEW.classificacao_risco, NEW.persistencia_7d, NEW.temp_media_c
  );

  INSERT INTO public.sla_operacional (
    item_id, cliente_id, prioridade, sla_horas, inicio, prazo_final, status
  ) VALUES (
    NEW.id,
    v_cliente_id,
    COALESCE(NEW.prioridade_operacional, 'Baixa'),
    v_horas_final,
    v_inicio,
    v_inicio + (v_horas_final || ' hours')::interval,
    'pendente'
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

-- Recria o trigger (mantém o nome existente)
DROP TRIGGER IF EXISTS trg_after_insert_pluvio_item_sla ON public.pluvio_operacional_item;
CREATE TRIGGER trg_after_insert_pluvio_item_sla
  AFTER INSERT ON public.pluvio_operacional_item
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_pluvio_item_criar_sla_auto();

-- ---------------------------------------------------------------------------
-- 5. Trigger AFTER INSERT em levantamento_itens → SLA automático
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_levantamento_item_criar_sla_auto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id  uuid;
  v_config      jsonb;
  v_horas       int;
  v_inicio      timestamptz;
BEGIN
  -- Idempotência
  IF EXISTS (
    SELECT 1 FROM public.sla_operacional
    WHERE levantamento_item_id = NEW.id
      AND status IN ('pendente', 'em_atendimento')
  ) THEN
    RETURN NEW;
  END IF;

  -- Resolve cliente via levantamento
  SELECT l.cliente_id INTO v_cliente_id
  FROM public.levantamentos l
  WHERE l.id = NEW.levantamento_id;

  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se sla_horas já foi calculado pela função criar_levantamento_item_manual, usa diretamente
  IF NEW.sla_horas IS NOT NULL AND NEW.sla_horas >= 1 THEN
    v_horas := NEW.sla_horas;
  ELSE
    SELECT c.config INTO v_config
    FROM public.sla_config c
    WHERE c.cliente_id = v_cliente_id
    LIMIT 1;
    v_horas := COALESCE(
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
    v_inicio + (v_horas || ' hours')::interval,
    'pendente'
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_levantamento_item_criar_sla_auto() IS
  'Trigger AFTER INSERT em levantamento_itens: cria automaticamente um SLA '
  'em sla_operacional para cada item novo (drone ou manual). '
  'Usa sla_horas do próprio item se já calculado, senão busca sla_config do cliente.';

DROP TRIGGER IF EXISTS trg_after_insert_levantamento_item_sla ON public.levantamento_itens;
CREATE TRIGGER trg_after_insert_levantamento_item_sla
  AFTER INSERT ON public.levantamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_levantamento_item_criar_sla_auto();

-- ---------------------------------------------------------------------------
-- 6. Atualiza operacoes trigger: fecha SLA por item_levantamento_id também
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.operacoes_on_status_concluido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF NEW.status <> 'concluido' THEN
    RETURN NEW;
  END IF;

  IF NEW.concluido_em IS NULL THEN
    NEW.concluido_em := v_now;
  END IF;

  -- Fecha SLA de item pluviométrico
  IF NEW.item_operacional_id IS NOT NULL THEN
    UPDATE public.sla_operacional
    SET concluido_em = v_now, status = 'concluido'
    WHERE item_id = NEW.item_operacional_id
      AND status IN ('pendente', 'em_atendimento');
  END IF;

  -- Fecha SLA de levantamento_item
  IF NEW.item_levantamento_id IS NOT NULL THEN
    UPDATE public.sla_operacional
    SET concluido_em = v_now, status = 'concluido'
    WHERE levantamento_item_id = NEW.item_levantamento_id
      AND status IN ('pendente', 'em_atendimento');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.operacoes_on_status_concluido() IS
  'Ao marcar operação como concluído: preenche concluido_em e fecha sla_operacional '
  'do item pluviométrico ou do levantamento_item vinculado.';

-- Recria trigger (mantém nome existente)
DROP TRIGGER IF EXISTS trg_operacoes_on_status_concluido ON public.operacoes;
CREATE TRIGGER trg_operacoes_on_status_concluido
  BEFORE UPDATE ON public.operacoes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'concluido')
  EXECUTE FUNCTION public.operacoes_on_status_concluido();

-- ---------------------------------------------------------------------------
-- 7. Atualiza marcar_slas_vencidos: usa cliente_id direto (mais simples)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_slas_vencidos(p_cliente_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.sla_operacional
  SET
    status  = 'vencido',
    violado = true
  WHERE status     IN ('pendente', 'em_atendimento')
    AND prazo_final < now()
    AND (p_cliente_id IS NULL OR cliente_id = p_cliente_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_slas_vencidos(uuid) TO authenticated;

COMMENT ON FUNCTION public.marcar_slas_vencidos(uuid) IS
  'Marca como vencido (e violado) todos os SLAs cujo prazo_final < now() e status ainda '
  'está pendente ou em_atendimento. Aceita cliente_id opcional (usa cliente_id direto). '
  'Retorna a quantidade de registros atualizados.';

-- ---------------------------------------------------------------------------
-- 8. Atualiza escalar_sla_operacional: suporta levantamento_item_id
-- ---------------------------------------------------------------------------
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
      'escalado',  false,
      'mensagem',  'Prioridade já está no nível máximo (' || v_sla.prioridade || ').'
    );
  END IF;

  -- Busca config do cliente (via campo cliente_id direto)
  SELECT c.config INTO v_config
  FROM public.sla_config c
  WHERE c.cliente_id = v_sla.cliente_id
  LIMIT 1;

  v_horas_base := public.sla_horas_from_config(v_config, v_nova_prio);

  -- Fatores ambientais só para itens pluviométricos
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
    -- Levantamento item: sem fatores ambientais
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
    'sla_horas',           v_horas_final
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.escalar_sla_operacional(uuid) TO authenticated;

COMMENT ON FUNCTION public.escalar_sla_operacional(uuid) IS
  'Escala um SLA para a próxima prioridade mais alta e recalcula o prazo usando sla_config. '
  'Para itens pluviométricos aplica fatores ambientais; para levantamento_itens usa apenas '
  'horas base. Usa cliente_id direto da sla_operacional (sem joins extras).';

-- ---------------------------------------------------------------------------
-- 9. Atualiza gerar_slas_para_run: preenche cliente_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_slas_para_run(p_run_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id  uuid;
  v_config      jsonb;
  v_item        record;
  v_horas_base  int;
  v_horas_final int;
  v_inicio      timestamptz;
  v_prazo_final timestamptz;
  v_inseridos   int := 0;
BEGIN
  SELECT cliente_id INTO v_cliente_id
  FROM public.pluvio_operacional_run
  WHERE id = p_run_id;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Run não encontrado: %', p_run_id;
  END IF;

  IF NOT public.usuario_pode_acessar_cliente(v_cliente_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerar SLA para este cliente';
  END IF;

  SELECT config INTO v_config
  FROM public.sla_config
  WHERE cliente_id = v_cliente_id;

  v_inicio := now();

  FOR v_item IN
    SELECT it.id AS item_id, it.prioridade_operacional,
           it.classificacao_risco, it.persistencia_7d, it.temp_media_c
    FROM public.pluvio_operacional_item it
    WHERE it.run_id = p_run_id
      AND NOT EXISTS (
        SELECT 1 FROM public.sla_operacional s
        WHERE s.item_id = it.id
          AND s.status IN ('pendente', 'em_atendimento')
      )
  LOOP
    v_horas_base  := public.sla_horas_from_config(v_config, v_item.prioridade_operacional);
    v_horas_final := public.sla_aplicar_fatores(
      v_horas_base, v_config,
      v_item.classificacao_risco, v_item.persistencia_7d, v_item.temp_media_c
    );
    v_prazo_final := v_inicio + (v_horas_final || ' hours')::interval;

    INSERT INTO public.sla_operacional (
      item_id, cliente_id, prioridade, sla_horas, inicio, prazo_final, status
    ) VALUES (
      v_item.item_id,
      v_cliente_id,
      COALESCE(v_item.prioridade_operacional, 'Baixa'),
      v_horas_final,
      v_inicio,
      v_prazo_final,
      'pendente'
    );
    v_inseridos := v_inseridos + 1;
  END LOOP;

  RETURN v_inseridos;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_slas_para_run(uuid) TO authenticated;
