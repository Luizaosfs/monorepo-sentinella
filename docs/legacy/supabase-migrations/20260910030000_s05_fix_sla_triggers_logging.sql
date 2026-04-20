-- =============================================================================
-- S05: Substituir EXCEPTION WHEN others silencioso por logging em sla_erros_criacao
--
-- Problema: triggers de criação de SLA engolem erros silenciosamente.
-- SLAs podem não ser criados sem nenhum alerta ao admin.
--
-- Fix: EXCEPTION WHEN others agora insere em sla_erros_criacao (tabela já existe)
-- em vez de ignorar. O INSERT original nunca é bloqueado (RETURN NEW sempre).
-- =============================================================================

-- ── 1. Trigger de pluvio_operacional_item ────────────────────────────────────

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
  -- Idempotência: não cria SLA duplicado
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

  v_inicio      := now();
  v_horas_base  := public.sla_horas_from_config(v_config, NEW.prioridade_operacional);
  v_horas_final := public.sla_aplicar_fatores(
    v_horas_base, v_config,
    NEW.classificacao_risco, NEW.persistencia_7d, NEW.temp_media_c
  );

  INSERT INTO public.sla_operacional (
    item_id, cliente_id, prioridade, sla_horas, inicio, prazo_final, status
  ) VALUES (
    NEW.id, v_cliente_id,
    COALESCE(NEW.prioridade_operacional, 'Baixa'),
    v_horas_final, v_inicio,
    v_inicio + (v_horas_final || ' hours')::interval,
    'pendente'
  );

  RETURN NEW;

EXCEPTION WHEN others THEN
  -- Registra o erro em vez de silenciar — admin pode ver em AdminSaudeSistema
  INSERT INTO public.sla_erros_criacao (
    cliente_id, item_id, levantamento_item_id, erro, contexto, created_at
  ) VALUES (
    v_cliente_id, NEW.id, NULL,
    SQLERRM,
    jsonb_build_object(
      'trigger', 'trg_pluvio_item_criar_sla_auto',
      'sqlstate', SQLSTATE,
      'run_id', NEW.run_id
    ),
    now()
  );
  RETURN NEW; -- nunca bloqueia o INSERT original
END;
$$;

DROP TRIGGER IF EXISTS trg_after_insert_pluvio_item_sla ON public.pluvio_operacional_item;
CREATE TRIGGER trg_after_insert_pluvio_item_sla
  AFTER INSERT ON public.pluvio_operacional_item
  FOR EACH ROW EXECUTE FUNCTION public.trg_pluvio_item_criar_sla_auto();

-- ── 2. Trigger de levantamento_itens ─────────────────────────────────────────

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
  LEFT JOIN public.planejamento p ON p.id = l.planejamento_id
  WHERE  l.id = NEW.levantamento_id;

  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sla_horas IS NOT NULL AND NEW.sla_horas >= 1 THEN
    v_horas := NEW.sla_horas;
  ELSE
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
    NEW.id, v_cliente_id,
    COALESCE(NEW.prioridade, 'Média'),
    v_horas, v_inicio,
    public.sla_calcular_prazo_final(
      v_inicio, v_horas,
      public.sla_resolve_config(v_cliente_id, v_regiao_id),
      v_cliente_id
    ),
    'pendente'
  );

  RETURN NEW;

EXCEPTION WHEN others THEN
  INSERT INTO public.sla_erros_criacao (
    cliente_id, item_id, levantamento_item_id, erro, contexto, created_at
  ) VALUES (
    v_cliente_id, NULL, NEW.id,
    SQLERRM,
    jsonb_build_object(
      'trigger', 'trg_levantamento_item_criar_sla_auto',
      'sqlstate', SQLSTATE,
      'levantamento_id', NEW.levantamento_id
    ),
    now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_insert_levantamento_item_sla ON public.levantamento_itens;
CREATE TRIGGER trg_after_insert_levantamento_item_sla
  AFTER INSERT ON public.levantamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.trg_levantamento_item_criar_sla_auto();

COMMENT ON FUNCTION public.trg_pluvio_item_criar_sla_auto() IS
  'S05: Cria SLA para pluvio_operacional_item. Erros registrados em sla_erros_criacao.';
COMMENT ON FUNCTION public.trg_levantamento_item_criar_sla_auto() IS
  'S05: Cria SLA para levantamento_itens. Erros registrados em sla_erros_criacao.';
