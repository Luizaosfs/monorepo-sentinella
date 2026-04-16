-- =============================================================================
-- P0-1: Corrigir joins incorretos entre papeis_usuarios e usuarios
--
-- RAIZ DO PROBLEMA:
--   papeis_usuarios.usuario_id = auth.uid()  (referencia direta ao auth.users.id)
--   usuarios.auth_id            = auth.uid()  (coluna de ligação)
--   usuarios.id                 = UUID interno (≠ auth.uid())
--
--   Padrão ERRADO:   JOIN papeis_usuarios pu ON pu.usuario_id = u.id
--                    (u.id é UUID interno — nunca bate com auth.uid())
--
--   Padrão CORRETO:  WHERE pu.usuario_id = auth.uid()  (direto)
--              ou:   JOIN papeis_usuarios pu ON pu.usuario_id = u.auth_id
--
-- Tabelas afetadas: cliente_integracoes, audit_log, cliente_plano,
--                   billing_ciclo, billing_usage_snapshot, job_queue
-- =============================================================================

-- ── 1. cliente_integracoes ────────────────────────────────────────────────────
-- Políticas leitura_admin_supervisor_integracoes e escrita_admin_integracoes
-- criadas em 20260729 com join errado e NUNCA dropadas.
-- A migration 20260914000002 criou políticas canônicas corretas (usando
-- usuario_pode_acessar_cliente). Apenas dropar as obsoletas.

DROP POLICY IF EXISTS "leitura_admin_supervisor_integracoes" ON public.cliente_integracoes;
DROP POLICY IF EXISTS "escrita_admin_integracoes"            ON public.cliente_integracoes;

-- ── 2. get_integracao_api_key() ───────────────────────────────────────────────
-- Função criada em 20260729 com join errado: pu.usuario_id = u.id
-- Reescrita usando papeis_usuarios.usuario_id = auth.uid() diretamente.
-- Admin é global (sem cliente_id) — verificação simplificada.

CREATE OR REPLACE FUNCTION public.get_integracao_api_key(p_integracao_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_key    text;
  v_cliente_id uuid;
BEGIN
  SELECT ci.api_key, ci.cliente_id
  INTO v_api_key, v_cliente_id
  FROM cliente_integracoes ci
  WHERE ci.id = p_integracao_id;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Integração não encontrada';
  END IF;

  -- Verificar: chamador é admin (global) OU supervisor do mesmo cliente
  IF NOT (
    public.is_admin()
    OR (public.is_supervisor() AND public.usuario_cliente_id() = v_cliente_id)
  ) THEN
    RAISE EXCEPTION 'Acesso negado — apenas admin ou supervisor do cliente podem visualizar a chave';
  END IF;

  RETURN v_api_key;
END;
$$;

REVOKE ALL ON FUNCTION public.get_integracao_api_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_integracao_api_key(uuid) TO authenticated;

-- ── 3. audit_log ─────────────────────────────────────────────────────────────
-- leitura_admin_audit_log criada em 20260730 com join errado.
-- Única política SELECT da tabela → admin/supervisor não liam logs.

DROP POLICY IF EXISTS "leitura_admin_audit_log" ON public.audit_log;
CREATE POLICY "leitura_admin_audit_log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.usuario_pode_acessar_cliente(cliente_id)
    )
  );

-- ── 4. cliente_plano ──────────────────────────────────────────────────────────
-- leitura_admin_cliente_plano criada em 20260731 com join errado.

DROP POLICY IF EXISTS "leitura_admin_cliente_plano" ON public.cliente_plano;
CREATE POLICY "leitura_admin_cliente_plano" ON public.cliente_plano
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.usuario_pode_acessar_cliente(cliente_id)
    )
  );

-- ── 5. billing_ciclo ──────────────────────────────────────────────────────────
-- leitura_admin_billing_ciclo criada em 20260732 com join errado.

DROP POLICY IF EXISTS "leitura_admin_billing_ciclo" ON public.billing_ciclo;
CREATE POLICY "leitura_admin_billing_ciclo" ON public.billing_ciclo
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.usuario_pode_acessar_cliente(cliente_id)
    )
  );

-- ── 6. billing_usage_snapshot ─────────────────────────────────────────────────
-- leitura_admin_billing_snapshot criada em 20260732 com join errado.

DROP POLICY IF EXISTS "leitura_admin_billing_snapshot" ON public.billing_usage_snapshot;
CREATE POLICY "leitura_admin_billing_snapshot" ON public.billing_usage_snapshot
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.usuario_pode_acessar_cliente(cliente_id)
    )
  );

-- ── 7. job_queue — supervisor cross-tenant leak ───────────────────────────────
-- job_queue_leitura (20260726): permite supervisor ver jobs de TODOS os clientes.
-- job_queue_select  (20260738): política canônica correta (admin + mesmo cliente).
-- Com dois SELECT ativos, Postgres faz OR → supervisor via leitura_leitura via
-- all rows. Dropar a obsoleta.

DROP POLICY IF EXISTS "job_queue_leitura" ON public.job_queue;

-- Garantir que job_queue_select inclua supervisor com filtro de cliente
DROP POLICY IF EXISTS "job_queue_select" ON public.job_queue;
CREATE POLICY "job_queue_select" ON public.job_queue
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      (payload->>'cliente_id') IS NOT NULL
      AND (payload->>'cliente_id')::uuid = public.usuario_cliente_id()
    )
  );
