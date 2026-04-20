-- =============================================================================
-- 20270202000002 — Corrigir papel_permitido_para_supervisor()
--
-- PROBLEMA:
--   A função papel_permitido_para_supervisor() (criada em 20260924000000_fix_rls_usuarios_papeis)
--   ainda listava 'operador' como papel válido para supervisor atribuir:
--     SELECT LOWER(p_papel) IN ('operador', 'notificador');
--   'operador' é papel morto desde 20261015000001. Supervisor deve atribuir
--   apenas 'agente' e 'notificador'. Permitir 'operador' viola a matriz de papéis
--   e cria confusão: RLS aprovaria a tentativa, mas o CHECK constraint de enum
--   rejeitaria — comportamento ambíguo e perigoso.
--
-- CORREÇÃO:
--   Substituir 'operador' por 'agente' na lista de papéis atribuíveis por supervisor.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.papel_permitido_para_supervisor(p_papel text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(p_papel) IN ('agente', 'notificador');
$$;

COMMENT ON FUNCTION public.papel_permitido_para_supervisor(text) IS
  'Papéis que supervisor pode atribuir a usuários do próprio cliente. '
  'Valores válidos: agente, notificador. '
  'Excluídos: admin, supervisor, moderador, operador (morto → agente), usuario (morto).';
