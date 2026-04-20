-- QW-06 Correção 1 + Correção 2: SLA — reabrir recalcula prazo + log de erros de criação
--
-- Correção 1: reabrir_sla() recalcula prazo_final usando now(), resolvendo o bug onde um SLA
--             reaberto ficava imediatamente vencido com o prazo original já expirado.
--
-- Correção 2: sla_erros_criacao registra falhas silenciosas do trigger trg_levantamento_item_criar_sla_auto.
--             Itens que entram sem SLA por erro passam a ter rastreabilidade.

-- ── Correção 1: Função reabrir_sla ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reabrir_sla(p_sla_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s             RECORD;
  v_prazo_final timestamptz;
BEGIN
  SELECT id, sla_horas, cliente_id
  INTO s
  FROM public.sla_operacional
  WHERE id = p_sla_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reabrir_sla: SLA % não encontrado', p_sla_id;
  END IF;

  -- Calcula novo prazo a partir de now(), respeitando horário comercial e feriados do cliente.
  -- Fallback: cálculo linear simples se a função de prazo não estiver disponível.
  BEGIN
    v_prazo_final := public.sla_calcular_prazo_final(
      now(),
      s.sla_horas,
      public.sla_resolve_config(s.cliente_id, NULL),
      s.cliente_id
    );
  EXCEPTION WHEN others THEN
    v_prazo_final := now() + (s.sla_horas || ' hours')::interval;
  END;

  UPDATE public.sla_operacional
  SET
    status       = 'pendente',
    concluido_em = null,
    inicio       = now(),
    prazo_final  = v_prazo_final,
    -- Limpar violado: item recebe nova oportunidade de atendimento
    violado      = false
  WHERE id = p_sla_id;
END;
$$;

COMMENT ON FUNCTION public.reabrir_sla(uuid) IS
  'Reabre um SLA concluído: volta para pendente, recalcula prazo_final a partir de now() '
  'respeitando horário comercial e feriados do cliente. '
  'Corrige o bug anterior onde reabrir mantinha prazo já expirado (QW-06).';

GRANT EXECUTE ON FUNCTION public.reabrir_sla(uuid) TO authenticated;

-- ── Correção 2: Tabela de log de erros de criação de SLA ─────────────────────

CREATE TABLE IF NOT EXISTS public.sla_erros_criacao (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  levantamento_item_id uuid,
  erro                 text        NOT NULL,
  criado_em            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sla_erros_criacao IS
  'Registra falhas na criação automática de SLA para levantamento_itens. '
  'Populado pelo trigger trg_levantamento_item_criar_sla_auto quando ocorre erro. '
  'Visível apenas para admin/gestor. (QW-06)';

-- RLS: apenas admin e gestor podem consultar erros de SLA
ALTER TABLE public.sla_erros_criacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_supervisor_pode_ver_erros_sla" ON public.sla_erros_criacao
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel IN ('admin', 'supervisor')
    )
  );

-- Sem RLS para INSERT: o trigger usa SECURITY DEFINER e insere diretamente
CREATE POLICY "trigger_pode_inserir_erros_sla" ON public.sla_erros_criacao
  FOR INSERT
  WITH CHECK (true);

-- ── Correção 2: Atualizar trigger para registrar erros em vez de silenciar ───

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
  v_prazo_final timestamptz;
  v_prior       text;
BEGIN
  -- Idempotência: não cria se já existe SLA aberto para este item
  IF EXISTS (
    SELECT 1 FROM public.sla_operacional
    WHERE levantamento_item_id = NEW.id
      AND status IN ('pendente', 'em_atendimento')
  ) THEN
    RETURN NEW;
  END IF;

  v_prior := COALESCE(NULLIF(trim(NEW.prioridade), ''), 'Média');

  -- Apenas P1/P2/P3 geram SLA automático
  IF NOT public.levantamento_item_prioridade_elegivel_sla_auto(v_prior) THEN
    RETURN NEW;
  END IF;

  -- Resolve cliente via levantamento
  SELECT l.cliente_id INTO v_cliente_id
  FROM public.levantamentos l
  WHERE l.id = NEW.levantamento_id;

  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calcula horas base
  IF NEW.sla_horas IS NOT NULL AND NEW.sla_horas >= 1 THEN
    v_horas := NEW.sla_horas;
  ELSE
    v_config := public.sla_resolve_config(v_cliente_id, NULL);
    v_horas  := COALESCE(
      public.sla_horas_from_config(v_config, v_prior),
      24
    );
  END IF;

  v_inicio := now();

  BEGIN
    v_prazo_final := public.sla_calcular_prazo_final(
      v_inicio,
      v_horas,
      public.sla_resolve_config(v_cliente_id, NULL),
      v_cliente_id
    );
  EXCEPTION WHEN undefined_function THEN
    v_prazo_final := v_inicio + (v_horas || ' hours')::interval;
  END;

  INSERT INTO public.sla_operacional (
    levantamento_item_id, cliente_id, prioridade, sla_horas, inicio, prazo_final, status
  ) VALUES (
    NEW.id,
    v_cliente_id,
    v_prior,
    v_horas,
    v_inicio,
    v_prazo_final,
    'pendente'
  );

  RETURN NEW;

EXCEPTION WHEN others THEN
  -- QW-06 Correção 2: registrar erro em vez de silenciar.
  -- O insert do levantamento_item NÃO é bloqueado — apenas o SLA deixa de ser criado.
  BEGIN
    INSERT INTO public.sla_erros_criacao (levantamento_item_id, erro)
    VALUES (NEW.id, SQLERRM);
  EXCEPTION WHEN others THEN
    -- Falha ao logar: último recurso é um WARNING nos logs do Postgres
    RAISE WARNING 'SLA não criado para levantamento_item % e log falhou: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_levantamento_item_criar_sla_auto() IS
  'Cria sla_operacional no INSERT de levantamento_item para prioridades P1/P2/P3. '
  'Erros são registrados em sla_erros_criacao em vez de silenciados. (QW-06)';
