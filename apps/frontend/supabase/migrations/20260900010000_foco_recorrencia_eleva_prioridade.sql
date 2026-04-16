-- =============================================================================
-- F-12: Elevar prioridade automaticamente ao vincular foco_anterior_id
--
-- Problema: quando o gestor marca um foco como recorrência de outro
-- (seta foco_anterior_id), a prioridade não é elevada automaticamente.
-- Regra: recorrência confirma padrão de risco no local → prioridade sobe 1 nível.
-- Sem downgrade: foco já em P1 permanece P1.
--
-- Trigger: AFTER UPDATE em focos_risco quando foco_anterior_id muda NULL → valor.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_elevar_prioridade_recorrencia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prioridade_atual text;
  v_prioridade_nova  text;
BEGIN
  -- Só age quando foco_anterior_id é preenchido (NULL → valor)
  IF OLD.foco_anterior_id IS NOT NULL OR NEW.foco_anterior_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_prioridade_atual := COALESCE(NEW.prioridade, 'P3');

  -- Eleva um nível (P5→P4, P4→P3, P3→P2, P2→P1, P1→P1)
  v_prioridade_nova := CASE v_prioridade_atual
    WHEN 'P5' THEN 'P4'
    WHEN 'P4' THEN 'P3'
    WHEN 'P3' THEN 'P2'
    WHEN 'P2' THEN 'P1'
    ELSE 'P1'  -- P1 permanece P1
  END;

  -- Só faz UPDATE se realmente subiu (evita trigger loop em P1)
  IF v_prioridade_nova <> v_prioridade_atual THEN
    UPDATE public.focos_risco
    SET
      prioridade = v_prioridade_nova,
      updated_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_elevar_prioridade_recorrencia ON public.focos_risco;
CREATE TRIGGER trg_elevar_prioridade_recorrencia
  AFTER UPDATE OF foco_anterior_id ON public.focos_risco
  FOR EACH ROW
  EXECUTE FUNCTION fn_elevar_prioridade_recorrencia();

COMMENT ON FUNCTION fn_elevar_prioridade_recorrencia() IS
  'F-12: Eleva prioridade do foco 1 nível ao vincular foco_anterior_id (recorrência). '
  'P5→P4→P3→P2→P1. Sem downgrade de P1. Registra em foco_risco_historico.';
