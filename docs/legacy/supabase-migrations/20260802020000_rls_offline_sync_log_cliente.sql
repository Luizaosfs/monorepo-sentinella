-- =============================================================================
-- 3C: Adicionar cliente_id e corrigir RLS de offline_sync_log
--
-- Problema: offline_sync_log não tem cliente_id — a política SELECT permite
-- que qualquer admin/supervisor da plataforma veja logs de TODOS os clientes
-- (cross-tenant). A política INSERT usa USING(true) — sem isolamento algum.
--
-- Fix:
--   1. Adicionar coluna cliente_id (nullable para não quebrar INSERTs existentes).
--   2. Backfill via usuarios.cliente_id.
--   3. Recriar políticas: INSERT popula cliente_id; SELECT escopa por cliente.
-- =============================================================================

-- ── 1. Adicionar coluna cliente_id ────────────────────────────────────────────
ALTER TABLE public.offline_sync_log
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_offline_sync_log_cliente
  ON public.offline_sync_log (cliente_id);

-- ── 2. Backfill: popular cliente_id a partir do usuário ───────────────────────
UPDATE public.offline_sync_log osl
SET cliente_id = u.cliente_id
FROM public.usuarios u
WHERE osl.usuario_id = u.id
  AND osl.cliente_id IS NULL;

-- ── 3. Recriar políticas RLS com isolamento por cliente ───────────────────────

DROP POLICY IF EXISTS "usuario_pode_inserir_sync_log"     ON public.offline_sync_log;
DROP POLICY IF EXISTS "admin_supervisor_pode_ver_sync_log" ON public.offline_sync_log;

-- INSERT: apenas usuários autenticados podem inserir seus próprios logs
CREATE POLICY "offline_sync_log_insert" ON public.offline_sync_log
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Deve referenciar o próprio usuário (ou ser NULL para retrocompatibilidade)
    (usuario_id IS NULL OR usuario_id IN (
      SELECT id FROM public.usuarios WHERE auth_id = auth.uid()
    ))
  );

-- SELECT: usuário vê seus próprios logs; admin/supervisor veem os do seu cliente
CREATE POLICY "offline_sync_log_select" ON public.offline_sync_log
  FOR SELECT TO authenticated
  USING (
    -- Próprio usuário
    usuario_id IN (
      SELECT id FROM public.usuarios WHERE auth_id = auth.uid()
    )
    OR
    -- Admin/supervisor veem logs do seu cliente (isolamento por tenant)
    (
      cliente_id IS NOT NULL
      AND usuario_pode_acessar_cliente(cliente_id)
      AND EXISTS (
        SELECT 1 FROM public.papeis_usuarios pu
        WHERE pu.usuario_id = auth.uid()
          AND pu.papel IN ('admin', 'supervisor')
      )
    )
  );
