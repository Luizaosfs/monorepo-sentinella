-- =============================================================================
-- P0-5: Canonizar get_meu_papel() — corrigir prioridade e documentar papéis
--
-- PROBLEMA:
--   A migration original (20250306140000) não inclui 'notificador' na escada
--   de prioridades — ele cai no ELSE 0. Já 'usuario' e 'cliente' estão na
--   escada com prioridade 1. Resultado: se um usuário tiver os papéis
--   'notificador' + 'usuario' (legado), a RPC retorna 'usuario', que o
--   normalizePapel() do frontend converte para null → login quebrado.
--
-- PAPÉIS CANÔNICOS (após P0-5):
--   admin       (5) — plataforma SaaS; acesso total
--   supervisor  (4) — gestor municipal
--   moderador   (4) — alias histórico de supervisor; normaliza para supervisor no frontend
--   operador    (3) — agente de campo; portal /agente/*
--   notificador (2) — funcionário UBS; portal /notificador/*
--   ELSE 0          — platform_admin (morto), usuario, cliente, qualquer legado
--
-- INVARIANTES:
--   - 'platform_admin' permanece no enum do banco mas é valor morto (ELSE 0).
--     Não é possível DROP VALUE em PostgreSQL sem recriar o enum.
--   - 'moderador' é alias permanente → mantido na escada (prioridade = supervisor).
--   - 'usuario' e 'cliente' não são atribuídos a novos usuários;
--     se existirem no banco, caem em ELSE 0 e normalizePapel() retorna null.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_meu_papel()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT LOWER(pu.papel::text)
  FROM papeis_usuarios pu
  WHERE pu.usuario_id = auth.uid()
  ORDER BY CASE LOWER(pu.papel::text)
    WHEN 'admin'       THEN 5
    WHEN 'supervisor'  THEN 4
    WHEN 'moderador'   THEN 4   -- alias permanente de supervisor
    WHEN 'operador'    THEN 3
    WHEN 'notificador' THEN 2
    ELSE 0                       -- platform_admin (morto), usuario, cliente, desconhecido
  END DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_meu_papel() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meu_papel() TO authenticated;

COMMENT ON FUNCTION public.get_meu_papel() IS
  'Retorna o papel de maior prioridade do usuário logado. '
  'Escada: admin(5) > supervisor/moderador(4) > operador(3) > notificador(2) > legado/morto(0). '
  'moderador é alias histórico de supervisor — normalizado no frontend por normalizePapel(). '
  'Fonte da verdade para menu, redirecionamento e guards no frontend.';
