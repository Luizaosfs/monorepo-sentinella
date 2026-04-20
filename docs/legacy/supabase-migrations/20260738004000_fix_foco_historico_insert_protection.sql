-- =============================================================================
-- Fix: foco_risco_historico — revogar INSERT direto de authenticated.
-- O ledger deve ser escrito apenas pelo trigger fn_registrar_historico_foco
-- (SECURITY DEFINER), nunca por INSERT direto de usuário autenticado.
-- =============================================================================

-- Revogar INSERT direto de authenticated
-- (a policy existente de INSERT torna-se irrelevante, mas mantemos para documentação)
REVOKE INSERT ON public.foco_risco_historico FROM authenticated;

COMMENT ON TABLE public.foco_risco_historico IS
  'Ledger append-only de transições de estado de focos_risco. '
  'NUNCA UPDATE. NUNCA DELETE. INSERT apenas via trigger fn_registrar_historico_foco. '
  'INSERT direto por authenticated revogado em Fix B-03. (QW-10 + Fix B-03)';
