-- =============================================================================
-- SLA — Feriados Municipais + Horário Comercial Real
-- Implementa o cálculo de prazo_final respeitando:
--   - Horário comercial (inicio/fim do expediente, dias da semana)
--   - Feriados municipais por cliente
-- O campo horario_comercial.ativo em sla_config já existe mas não era usado.
-- Esta migration ativa o suporte real.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela sla_feriados
-- Feriados por cliente. Pode incluir feriados nacionais (nacional = true)
-- e municipais/estaduais específicos do cliente.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sla_feriados (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data        date        NOT NULL,
  descricao   text        NOT NULL,
  nacional    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, data)
);

COMMENT ON TABLE public.sla_feriados IS
  'Feriados por cliente. Usados no cálculo de prazo_final quando horario_comercial.ativo = true. '
  'nacional = true indica feriado nacional (válido para todos os clientes).';

CREATE INDEX IF NOT EXISTS sla_feriados_cliente_data_idx
  ON public.sla_feriados (cliente_id, data);

ALTER TABLE public.sla_feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_feriados_select" ON public.sla_feriados;
CREATE POLICY "sla_feriados_select" ON public.sla_feriados
  FOR SELECT TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_feriados_insert" ON public.sla_feriados;
CREATE POLICY "sla_feriados_insert" ON public.sla_feriados
  FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_feriados_update" ON public.sla_feriados;
CREATE POLICY "sla_feriados_update" ON public.sla_feriados
  FOR UPDATE TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_feriados_delete" ON public.sla_feriados;
CREATE POLICY "sla_feriados_delete" ON public.sla_feriados
  FOR DELETE TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_feriados TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Seed de feriados nacionais brasileiros fixos (ano 2025 e 2026)
-- Chamado ao criar cliente.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_sla_feriados_nacionais(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sla_feriados (cliente_id, data, descricao, nacional)
  VALUES
    -- 2025
    (p_cliente_id, '2025-01-01', 'Confraternização Universal',     true),
    (p_cliente_id, '2025-04-18', 'Sexta-feira Santa',              true),
    (p_cliente_id, '2025-04-21', 'Tiradentes',                     true),
    (p_cliente_id, '2025-05-01', 'Dia do Trabalhador',             true),
    (p_cliente_id, '2025-09-07', 'Independência do Brasil',        true),
    (p_cliente_id, '2025-10-12', 'Nossa Sra. Aparecida',           true),
    (p_cliente_id, '2025-11-02', 'Finados',                        true),
    (p_cliente_id, '2025-11-15', 'Proclamação da República',       true),
    (p_cliente_id, '2025-11-20', 'Consciência Negra',              true),
    (p_cliente_id, '2025-12-25', 'Natal',                          true),
    -- 2026
    (p_cliente_id, '2026-01-01', 'Confraternização Universal',     true),
    (p_cliente_id, '2026-04-03', 'Sexta-feira Santa',              true),
    (p_cliente_id, '2026-04-21', 'Tiradentes',                     true),
    (p_cliente_id, '2026-05-01', 'Dia do Trabalhador',             true),
    (p_cliente_id, '2026-09-07', 'Independência do Brasil',        true),
    (p_cliente_id, '2026-10-12', 'Nossa Sra. Aparecida',           true),
    (p_cliente_id, '2026-11-02', 'Finados',                        true),
    (p_cliente_id, '2026-11-15', 'Proclamação da República',       true),
    (p_cliente_id, '2026-11-20', 'Consciência Negra',              true),
    (p_cliente_id, '2026-12-25', 'Natal',                          true)
  ON CONFLICT (cliente_id, data) DO NOTHING;
END;
$$;

-- Trigger: seed feriados ao criar cliente
CREATE OR REPLACE FUNCTION public.trg_seed_sla_feriados_on_cliente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_sla_feriados_nacionais(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_sla_feriados_on_cliente ON public.clientes;
CREATE TRIGGER trg_seed_sla_feriados_on_cliente
  AFTER INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_sla_feriados_on_cliente();

-- -----------------------------------------------------------------------------
-- 3. Helper: avança timestamp para o próximo slot de horário comercial
-- Usada internamente por sla_calcular_prazo_final.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sla_proximo_slot_comercial(
  p_cursor       timestamptz,
  p_hora_inicio  time,
  p_hora_fim     time,
  p_dias_semana  int[],         -- dias úteis: 0=dom,1=seg,...,6=sab (extract dow)
  p_feriados     date[]
) RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cursor    timestamptz := p_cursor;
  v_tentativas int := 0;
BEGIN
  LOOP
    -- Proteção contra loop infinito (ex.: nenhum dia útil configurado)
    v_tentativas := v_tentativas + 1;
    IF v_tentativas > 365 THEN
      RETURN v_cursor; -- fallback: retorna sem ajuste
    END IF;

    -- Verifica se o dia é útil (não é feriado e está nos dias configurados)
    IF extract(dow from v_cursor)::int = ANY(p_dias_semana)
       AND NOT (v_cursor::date = ANY(p_feriados))
    THEN
      -- Dia útil: ajusta para dentro do horário comercial
      IF v_cursor::time < p_hora_inicio THEN
        -- Antes do expediente: avança para o início
        RETURN date_trunc('day', v_cursor) + p_hora_inicio;
      ELSIF v_cursor::time >= p_hora_fim THEN
        -- Depois do expediente: vai para o início do próximo dia útil
        v_cursor := date_trunc('day', v_cursor) + interval '1 day' + p_hora_inicio;
        CONTINUE;
      ELSE
        -- Dentro do expediente
        RETURN v_cursor;
      END IF;
    ELSE
      -- Dia não útil: pula para o início do próximo dia
      v_cursor := date_trunc('day', v_cursor) + interval '1 day' + p_hora_inicio;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.sla_proximo_slot_comercial IS
  'Avança o cursor para o próximo momento dentro do horário comercial, '
  'respeitando dias da semana e feriados.';

-- -----------------------------------------------------------------------------
-- 4. Função principal: sla_calcular_prazo_final
-- Calcula o prazo_final do SLA respeitando horário comercial e feriados.
-- Se horario_comercial.ativo = false: cálculo simples (compatibilidade total).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sla_calcular_prazo_final(
  p_inicio      timestamptz,
  p_sla_horas   int,
  p_config      jsonb,
  p_cliente_id  uuid DEFAULT NULL
) RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_hc           jsonb;
  v_ativo        boolean;
  v_hora_inicio  time;
  v_hora_fim     time;
  v_dias_semana  int[];
  v_feriados     date[];
  v_cursor       timestamptz;
  v_horas_rest   numeric;
  v_horas_hoje   numeric;
  v_horas_dia    numeric;
BEGIN
  v_hc    := p_config -> 'horario_comercial';
  v_ativo := COALESCE((v_hc ->> 'ativo')::boolean, false);

  -- Modo simples: sem horário comercial
  IF NOT v_ativo OR v_hc IS NULL OR p_sla_horas IS NULL OR p_sla_horas <= 0 THEN
    RETURN p_inicio + (COALESCE(p_sla_horas, 0) || ' hours')::interval;
  END IF;

  v_hora_inicio := COALESCE((v_hc ->> 'inicio')::time, '08:00'::time);
  v_hora_fim    := COALESCE((v_hc ->> 'fim')::time,    '18:00'::time);
  v_horas_dia   := extract(epoch from (v_hora_fim - v_hora_inicio)) / 3600.0;

  IF v_horas_dia <= 0 THEN
    RETURN p_inicio + (p_sla_horas || ' hours')::interval;
  END IF;

  -- Dias úteis da semana (padrão: seg–sex)
  SELECT array_agg(value::int)
  INTO v_dias_semana
  FROM jsonb_array_elements_text(COALESCE(v_hc -> 'dias_semana', '[1,2,3,4,5]'::jsonb));
  v_dias_semana := COALESCE(v_dias_semana, ARRAY[1,2,3,4,5]);

  -- Feriados no período estimado (3x o prazo como margem)
  IF p_cliente_id IS NOT NULL THEN
    SELECT array_agg(data) INTO v_feriados
    FROM public.sla_feriados
    WHERE cliente_id = p_cliente_id
      AND data BETWEEN p_inicio::date
                   AND (p_inicio + ((p_sla_horas * 3) || ' hours')::interval)::date;
  END IF;
  v_feriados := COALESCE(v_feriados, ARRAY[]::date[]);

  -- Posiciona cursor no primeiro slot útil
  v_cursor    := public.sla_proximo_slot_comercial(p_inicio, v_hora_inicio, v_hora_fim, v_dias_semana, v_feriados);
  v_horas_rest := p_sla_horas;

  WHILE v_horas_rest > 0 LOOP
    -- Horas disponíveis até o fim do expediente de hoje
    v_horas_hoje := extract(epoch from (v_hora_fim - v_cursor::time)) / 3600.0;

    IF v_horas_hoje <= 0 THEN
      -- Já passou do expediente: avança para o próximo dia útil
      v_cursor := public.sla_proximo_slot_comercial(
        date_trunc('day', v_cursor) + interval '1 day' + v_hora_inicio,
        v_hora_inicio, v_hora_fim, v_dias_semana, v_feriados
      );
      CONTINUE;
    END IF;

    IF v_horas_rest <= v_horas_hoje THEN
      v_cursor     := v_cursor + (v_horas_rest || ' hours')::interval;
      v_horas_rest := 0;
    ELSE
      v_horas_rest := v_horas_rest - v_horas_hoje;
      v_cursor := public.sla_proximo_slot_comercial(
        date_trunc('day', v_cursor) + interval '1 day' + v_hora_inicio,
        v_hora_inicio, v_hora_fim, v_dias_semana, v_feriados
      );
    END IF;
  END LOOP;

  RETURN v_cursor;
END;
$$;

COMMENT ON FUNCTION public.sla_calcular_prazo_final IS
  'Calcula prazo_final do SLA. '
  'Se horario_comercial.ativo = true, avança apenas em horário útil, '
  'respeitando dias da semana e feriados do cliente. '
  'Compatível com código anterior: quando ativo = false, retorna inicio + sla_horas simples.';

-- -----------------------------------------------------------------------------
-- 5. Atualiza funções que calculam prazo_final para usar sla_calcular_prazo_final
-- -----------------------------------------------------------------------------

-- 5a. gerar_slas_para_run: recria com suporte a horário comercial
CREATE OR REPLACE FUNCTION public.gerar_slas_para_run(p_run_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run       RECORD;
  v_item      RECORD;
  v_config    jsonb;
  v_horas     int;
  v_horas_final int;
  v_prazo     timestamptz;
  v_count     int := 0;
BEGIN
  SELECT * INTO v_run FROM public.pluvio_operacional_run WHERE id = p_run_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT config INTO v_config FROM public.sla_config WHERE cliente_id = v_run.cliente_id LIMIT 1;

  FOR v_item IN
    SELECT * FROM public.pluvio_operacional_item WHERE run_id = p_run_id
  LOOP
    -- Idempotente
    IF EXISTS (
      SELECT 1 FROM public.sla_operacional
      WHERE item_id = v_item.id AND status IN ('pendente', 'em_atendimento')
    ) THEN CONTINUE; END IF;

    v_horas       := public.sla_horas_from_config(v_config, v_item.prioridade_operacional);
    v_horas_final := public.sla_aplicar_fatores(
      v_horas, v_config,
      v_item.classificacao_risco,
      v_item.persistencia_7d,
      v_item.temp_media_c
    );
    v_prazo := public.sla_calcular_prazo_final(now(), v_horas_final, v_config, v_run.cliente_id);

    INSERT INTO public.sla_operacional
      (item_id, cliente_id, prioridade, sla_horas, inicio, prazo_final, status)
    VALUES
      (v_item.id, v_run.cliente_id, v_item.prioridade_operacional, v_horas_final, now(), v_prazo, 'pendente');

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 5b. trg_levantamento_item_criar_sla_auto: recria com suporte a horário comercial
CREATE OR REPLACE FUNCTION public.trg_levantamento_item_criar_sla_auto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id  uuid;
  v_config      jsonb;
  v_sla_horas   int;
  v_prazo       timestamptz;
BEGIN
  -- Idempotente: não cria duplicado
  IF EXISTS (
    SELECT 1 FROM public.sla_operacional
    WHERE levantamento_item_id = NEW.id AND status IN ('pendente', 'em_atendimento')
  ) THEN RETURN NEW; END IF;

  SELECT lev.cliente_id INTO v_cliente_id
  FROM public.levantamentos lev WHERE lev.id = NEW.levantamento_id LIMIT 1;

  IF v_cliente_id IS NULL THEN RETURN NEW; END IF;

  SELECT config INTO v_config FROM public.sla_config WHERE cliente_id = v_cliente_id LIMIT 1;

  -- Usa sla_horas já calculado pelo RPC, ou recalcula
  IF NEW.sla_horas IS NOT NULL AND NEW.sla_horas >= 1 THEN
    v_sla_horas := NEW.sla_horas;
  ELSE
    v_sla_horas := public.sla_horas_from_config(v_config, COALESCE(NEW.prioridade, 'Média'));
    v_sla_horas := COALESCE(v_sla_horas, 24);
  END IF;

  v_prazo := public.sla_calcular_prazo_final(now(), v_sla_horas, v_config, v_cliente_id);

  INSERT INTO public.sla_operacional
    (levantamento_item_id, cliente_id, prioridade, sla_horas, inicio, prazo_final, status)
  VALUES
    (NEW.id, v_cliente_id, COALESCE(NEW.prioridade, 'Média'), v_sla_horas, now(), v_prazo, 'pendente');

  RETURN NEW;
END;
$$;

-- 5c. escalar_sla_operacional: recria com suporte a horário comercial
CREATE OR REPLACE FUNCTION public.escalar_sla_operacional(p_sla_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla           RECORD;
  v_nova_prio     text;
  v_config        jsonb;
  v_horas_base    int;
  v_horas_final   int;
  v_novo_prazo    timestamptz;
BEGIN
  SELECT * INTO v_sla FROM public.sla_operacional WHERE id = p_sla_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('escalado', false, 'mensagem', 'SLA não encontrado');
  END IF;
  IF v_sla.status = 'concluido' THEN
    RETURN jsonb_build_object('escalado', false, 'mensagem', 'SLA já concluído');
  END IF;

  v_nova_prio := public.escalar_prioridade(v_sla.prioridade);
  IF v_nova_prio = v_sla.prioridade THEN
    RETURN jsonb_build_object('escalado', false, 'mensagem', 'Já na prioridade máxima');
  END IF;

  SELECT config INTO v_config FROM public.sla_config WHERE cliente_id = v_sla.cliente_id LIMIT 1;

  v_horas_base := public.sla_horas_from_config(v_config, v_nova_prio);

  -- Aplica fatores ambientais apenas para itens pluviométricos
  IF v_sla.item_id IS NOT NULL THEN
    DECLARE
      v_item RECORD;
    BEGIN
      SELECT pi.classificacao_risco, pi.persistencia_7d, pi.temp_media_c
      INTO v_item
      FROM public.pluvio_operacional_item pi WHERE pi.id = v_sla.item_id;
      v_horas_final := public.sla_aplicar_fatores(
        v_horas_base, v_config,
        v_item.classificacao_risco, v_item.persistencia_7d, v_item.temp_media_c
      );
    END;
  ELSE
    v_horas_final := v_horas_base;
  END IF;

  v_novo_prazo := public.sla_calcular_prazo_final(now(), v_horas_final, v_config, v_sla.cliente_id);

  UPDATE public.sla_operacional SET
    prioridade         = v_nova_prio,
    sla_horas          = v_horas_final,
    inicio             = now(),
    prazo_final        = v_novo_prazo,
    escalonado         = true,
    escalonado_em      = now(),
    prioridade_original = COALESCE(prioridade_original, v_sla.prioridade),
    status             = CASE WHEN status = 'vencido' THEN 'pendente' ELSE status END
  WHERE id = p_sla_id;

  RETURN jsonb_build_object(
    'escalado',            true,
    'prioridade_anterior', v_sla.prioridade,
    'prioridade_nova',     v_nova_prio,
    'sla_horas',           v_horas_final,
    'prazo_final',         v_novo_prazo
  );
END;
$$;
