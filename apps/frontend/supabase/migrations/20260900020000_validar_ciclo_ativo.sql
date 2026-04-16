-- =============================================================================
-- V-11 / CI-04 / CI-05: Validar ciclo ativo em vistorias e focos_risco
--
-- Problema:
--   V-11/CI-04: Agente pode criar vistoria com ciclo errado (ex: ciclo 3 quando
--               o cliente está no ciclo 2). Sem nenhuma validação no banco.
--   CI-05: focos_risco.ciclo não referencia o ciclo ativo do cliente —
--          pode ser criado com ciclo inconsistente pelo trigger.
--
-- Estratégia:
--   1. fn_ciclo_ativo_numero(p_cliente_id) → retorna numero do ciclo ativo ou NULL
--   2. Trigger em vistorias: BLOQUEIA se ciclo ativo existe e NEW.ciclo != ativo
--   3. Trigger em focos_risco: AUTO-PREENCHE ciclo a partir do ciclo ativo (não bloqueia —
--      focos são criados por triggers do sistema que não têm acesso ao ciclo ativo)
-- =============================================================================

-- ── 1. Função auxiliar: retorna numero do ciclo ativo do cliente ───────────────

CREATE OR REPLACE FUNCTION public.fn_ciclo_ativo_numero(p_cliente_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT numero
  FROM public.ciclos
  WHERE cliente_id = p_cliente_id
    AND status = 'ativo'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.fn_ciclo_ativo_numero(uuid) IS
  'Retorna o número (1–6) do ciclo ativo do cliente, ou NULL se não houver ciclo formal ativo.';

GRANT EXECUTE ON FUNCTION public.fn_ciclo_ativo_numero(uuid) TO authenticated;

-- ── 2. V-11/CI-04: Trigger em vistorias ──────────────────────────────────────
-- Bloqueia INSERT quando ciclo ativo existe E o ciclo informado é diferente.
-- Se não há ciclo formal ativo (cliente ainda não usa tabela ciclos), permite.

CREATE OR REPLACE FUNCTION fn_validar_ciclo_vistoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ciclo_ativo int;
BEGIN
  v_ciclo_ativo := public.fn_ciclo_ativo_numero(NEW.cliente_id);

  -- Sem ciclo ativo formal → sem restrição (cliente ainda não usa tabela ciclos)
  IF v_ciclo_ativo IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ciclo informado deve coincidir com o ativo
  IF NEW.ciclo <> v_ciclo_ativo THEN
    RAISE EXCEPTION
      'Vistoria com ciclo % rejeitada: ciclo ativo do cliente é %. '
      'Encerre o ciclo ativo antes de registrar vistorias em outro ciclo.',
      NEW.ciclo, v_ciclo_ativo
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_ciclo_vistoria ON public.vistorias;
CREATE TRIGGER trg_validar_ciclo_vistoria
  BEFORE INSERT ON public.vistorias
  FOR EACH ROW
  EXECUTE FUNCTION fn_validar_ciclo_vistoria();

COMMENT ON FUNCTION fn_validar_ciclo_vistoria() IS
  'V-11/CI-04: Bloqueia INSERT em vistorias com ciclo diferente do ciclo ativo do cliente. '
  'Só age se houver ciclo formal ativo — clientes sem tabela de ciclos não são afetados.';

-- ── 3. CI-05: Trigger em focos_risco — auto-preenche ciclo ───────────────────
-- Focos são criados por triggers do sistema (sem acesso explícito ao ciclo).
-- Estratégia: SET ciclo = ciclo_ativo se NEW.ciclo IS NULL ou 0.
-- Se ciclo ativo não existe, mantém o valor informado.

CREATE OR REPLACE FUNCTION fn_normalizar_ciclo_foco_risco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ciclo_ativo int;
BEGIN
  -- Só age quando ciclo não foi explicitamente informado
  IF NEW.ciclo IS NOT NULL AND NEW.ciclo BETWEEN 1 AND 6 THEN
    RETURN NEW;
  END IF;

  v_ciclo_ativo := public.fn_ciclo_ativo_numero(NEW.cliente_id);

  IF v_ciclo_ativo IS NOT NULL THEN
    NEW.ciclo := v_ciclo_ativo;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalizar_ciclo_foco_risco ON public.focos_risco;
CREATE TRIGGER trg_normalizar_ciclo_foco_risco
  BEFORE INSERT ON public.focos_risco
  FOR EACH ROW
  EXECUTE FUNCTION fn_normalizar_ciclo_foco_risco();

COMMENT ON FUNCTION fn_normalizar_ciclo_foco_risco() IS
  'CI-05: Auto-preenche focos_risco.ciclo com o ciclo ativo do cliente quando NULL ou inválido. '
  'Não bloqueia — focos são criados por triggers do sistema.';
