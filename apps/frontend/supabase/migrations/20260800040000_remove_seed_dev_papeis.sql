-- =============================================================================
-- 1E: Remover papéis do usuário de desenvolvimento de produção
--
-- Problema: 20250306160000_seed_operador_luiz.sql inseriu papel 'operador'
-- para luizantoniooliveira.1001@gmail.com diretamente no banco de produção.
-- Usuários de desenvolvimento não devem ter papéis ativos em produção.
--
-- Fix: revogar todos os papéis do usuário de dev. Não remove o usuário —
-- apenas revoga acessos operacionais. Idempotente (DELETE WHERE).
-- =============================================================================

DELETE FROM public.papeis_usuarios
WHERE usuario_id IN (
  SELECT auth_id FROM public.usuarios
  WHERE email = 'luizantoniooliveira.1001@gmail.com'
    AND auth_id IS NOT NULL
);

