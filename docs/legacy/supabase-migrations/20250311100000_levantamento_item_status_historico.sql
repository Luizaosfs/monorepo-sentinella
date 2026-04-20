-- =============================================================================
-- Levantamento Item Status Histórico
-- Registra cada mudança de status_atendimento em levantamento_itens,
-- incluindo a acao_aplicada no momento da transição.
-- Segue o mesmo padrão de sla_config_audit.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela de histórico
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.levantamento_item_status_historico (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  levantamento_item_id    uuid        NOT NULL
                            REFERENCES public.levantamento_itens(id) ON DELETE CASCADE,
  cliente_id              uuid        NOT NULL,   -- denormalizado para RLS eficiente
  status_anterior         text,                   -- NULL na primeira transição a partir de NULL
  status_novo             text        NOT NULL,
  acao_aplicada_anterior  text,
  acao_aplicada_nova      text,
  alterado_por            uuid
                            REFERENCES public.usuarios(id) ON DELETE SET NULL,
  alterado_em             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.levantamento_item_status_historico IS
  'Trilha de auditoria das mudanças de status_atendimento em levantamento_itens. '
  'Populado automaticamente pelo trigger trg_levantamento_item_status_historico.';

-- Índice principal: buscar histórico de um item específico
CREATE INDEX IF NOT EXISTS lev_item_status_hist_item_idx
  ON public.levantamento_item_status_historico (levantamento_item_id, alterado_em DESC);

-- Índice para consultas por cliente (relatórios, auditoria)
CREATE INDEX IF NOT EXISTS lev_item_status_hist_cliente_idx
  ON public.levantamento_item_status_historico (cliente_id, alterado_em DESC);

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.levantamento_item_status_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lev_item_status_hist_select" ON public.levantamento_item_status_historico;
CREATE POLICY "lev_item_status_hist_select" ON public.levantamento_item_status_historico
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "lev_item_status_hist_insert" ON public.levantamento_item_status_historico;
CREATE POLICY "lev_item_status_hist_insert" ON public.levantamento_item_status_historico
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- -----------------------------------------------------------------------------
-- 3. Função do trigger
-- SECURITY DEFINER para bypassar RLS no INSERT interno.
-- Só dispara quando status_atendimento muda de fato.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_levantamento_item_status_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_auth_uid   uuid := auth.uid();
  v_cliente_id uuid;
BEGIN
  -- Só age quando status_atendimento muda
  IF NEW.status_atendimento IS NOT DISTINCT FROM OLD.status_atendimento THEN
    RETURN NEW;
  END IF;

  -- Resolve auth_id → usuarios.id (pode ser NULL se chamado por sistema/trigger)
  IF v_auth_uid IS NOT NULL THEN
    SELECT id INTO v_usuario_id
    FROM public.usuarios
    WHERE auth_id = v_auth_uid
    LIMIT 1;
  END IF;

  -- Obtém cliente_id a partir do levantamento (denormalizado para RLS)
  SELECT lev.cliente_id INTO v_cliente_id
  FROM public.levantamentos lev
  WHERE lev.id = NEW.levantamento_id
  LIMIT 1;

  INSERT INTO public.levantamento_item_status_historico (
    levantamento_item_id,
    cliente_id,
    status_anterior,
    status_novo,
    acao_aplicada_anterior,
    acao_aplicada_nova,
    alterado_por,
    alterado_em
  ) VALUES (
    NEW.id,
    v_cliente_id,
    OLD.status_atendimento,
    NEW.status_atendimento,
    OLD.acao_aplicada,
    NEW.acao_aplicada,
    v_usuario_id,
    now()
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_levantamento_item_status_historico() IS
  'Registra em levantamento_item_status_historico cada vez que status_atendimento muda. '
  'Inclui acao_aplicada anterior e nova para rastreabilidade completa da transição.';

-- -----------------------------------------------------------------------------
-- 4. Trigger em levantamento_itens
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_levantamento_item_status_historico ON public.levantamento_itens;

CREATE TRIGGER trg_levantamento_item_status_historico
  AFTER UPDATE ON public.levantamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_levantamento_item_status_historico();

-- Permissão de leitura (RLS cuida do filtro por cliente)
GRANT SELECT ON public.levantamento_item_status_historico TO authenticated;
