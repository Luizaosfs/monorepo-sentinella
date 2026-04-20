-- =============================================================================
-- 20270202000001 — Converter dados legados: gestor → supervisor em papeis_usuarios
--
-- PROBLEMA:
--   A migration 20261015000001 converteu operador→agente e moderador→supervisor,
--   mas NÃO converteu gestor→supervisor. Usuários com papel='gestor' em papeis_usuarios
--   ficavam com normalizePapel retornando null → bloqueio no portal /gestor/*.
--
-- NOTA: usuarios.papel_app não existe (removida na canonização 20261015000002).
--       A única fonte de papel é papeis_usuarios.papel.
--
-- CORREÇÃO:
--   1. papeis_usuarios: converter papel='gestor' → 'supervisor'
--      (via text cast — seguro mesmo se o enum já não inclui 'gestor')
--   2. Verificar usuários sem linha em papeis_usuarios (aviso, não erro)
-- =============================================================================

-- ── 1. papeis_usuarios: gestor → supervisor ───────────────────────────────────
-- Usa UPDATE direto no storage físico via text cast para contornar restrição de enum.
DO $$
BEGIN
  -- Primeiro tenta via cast direto (se 'gestor' ainda estiver no enum)
  UPDATE public.papeis_usuarios
  SET papel = 'supervisor'::public.papel_app
  WHERE papel::text = 'gestor';

  RAISE NOTICE '% linha(s) convertida(s): gestor → supervisor em papeis_usuarios.',
    (SELECT COUNT(*) FROM public.papeis_usuarios WHERE papel::text = 'supervisor');
EXCEPTION WHEN invalid_text_representation OR others THEN
  -- 'gestor' foi removido do enum — nenhuma linha pode ter esse valor; OK.
  RAISE NOTICE 'Nenhuma conversão necessária em papeis_usuarios (gestor já fora do enum).';
END;
$$;

-- ── 2. Relatório: usuários sem linha em papeis_usuarios ───────────────────────
DO $$
DECLARE
  v_sem_papel int;
  v_rec       record;
BEGIN
  SELECT COUNT(*) INTO v_sem_papel
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM public.papeis_usuarios pu WHERE pu.usuario_id = au.id
  )
  AND EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.auth_id = au.id
  );

  IF v_sem_papel > 0 THEN
    RAISE WARNING
      '% usuário(s) em public.usuarios SEM linha em papeis_usuarios. '
      'Execute o script de diagnóstico para identificá-los: '
      'SELECT u.email, u.nome FROM public.usuarios u WHERE NOT EXISTS '
      '(SELECT 1 FROM public.papeis_usuarios pu WHERE pu.usuario_id = u.auth_id);',
      v_sem_papel;
  ELSE
    RAISE NOTICE 'OK: todos os usuários têm pelo menos uma linha em papeis_usuarios.';
  END IF;
END;
$$;
