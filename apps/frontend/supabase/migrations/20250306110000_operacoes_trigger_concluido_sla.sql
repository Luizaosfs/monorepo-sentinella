-- =============================================================================
-- LÓGICA DE HISTÓRICO E ATENDIMENTO — OPERAÇÕES
-- 1. Garantir constraint de status (pendente, em_andamento, concluido).
-- 2. Trigger: ao atualizar operacoes.status para 'concluido', preencher
--    concluido_em com now() e atualizar sla_operacional correspondente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Constraint de status em operacoes (se não existir)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operacoes_status_check'
    AND conrelid = 'public.operacoes'::regclass
  ) THEN
    ALTER TABLE public.operacoes
      ADD CONSTRAINT operacoes_status_check
      CHECK (status IN ('pendente', 'em_andamento', 'concluido'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Função do trigger: ao concluir operação
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.operacoes_on_status_concluido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Só age quando status passa a 'concluido'
  IF NEW.status <> 'concluido' THEN
    RETURN NEW;
  END IF;

  -- Preencher concluido_em se ainda estiver nulo
  IF NEW.concluido_em IS NULL THEN
    NEW.concluido_em := v_now;
  END IF;

  -- Atualizar sla_operacional quando a operação está ligada a item pluviométrico
  IF NEW.item_operacional_id IS NOT NULL THEN
    UPDATE public.sla_operacional
    SET
      concluido_em = v_now,
      status = 'concluido'
    WHERE item_id = NEW.item_operacional_id
      AND status IN ('pendente', 'em_atendimento');
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Trigger BEFORE UPDATE em operacoes
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_operacoes_on_status_concluido ON public.operacoes;

CREATE TRIGGER trg_operacoes_on_status_concluido
  BEFORE UPDATE ON public.operacoes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'concluido')
  EXECUTE FUNCTION public.operacoes_on_status_concluido();

COMMENT ON FUNCTION public.operacoes_on_status_concluido() IS
  'Ao marcar operação como concluído: preenche concluido_em e atualiza sla_operacional do item pluviométrico vinculado.';
