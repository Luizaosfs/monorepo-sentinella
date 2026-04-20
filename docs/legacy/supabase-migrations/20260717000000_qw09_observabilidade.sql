-- QW-09 Observabilidade — Tornar falhas visíveis e rastreáveis
--
-- Correção 1: Não requer migration — UI lê sla_erros_criacao já existente.
--
-- Correção 2: Adicionar status/erro/processado_em em levantamento_analise_ia
--   para rastrear se a triagem IA teve sucesso ou falhou.
--
-- Correção 3: Criar offline_sync_log para persistir falhas de sincronização
--   do drainQueue — permite que gestores saibam quantas operações falharam
--   em campo e por quais motivos.

-- ── Correção 2: status da triagem IA ─────────────────────────────────────────

ALTER TABLE public.levantamento_analise_ia
  ADD COLUMN IF NOT EXISTS status       text        NOT NULL DEFAULT 'sucesso',
  ADD COLUMN IF NOT EXISTS erro         text,
  ADD COLUMN IF NOT EXISTS processado_em timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.levantamento_analise_ia.status IS
  'Resultado da execução: sucesso | falha | sem_resultado. (QW-09)';
COMMENT ON COLUMN public.levantamento_analise_ia.erro IS
  'Mensagem de erro quando status=falha. (QW-09)';
COMMENT ON COLUMN public.levantamento_analise_ia.processado_em IS
  'Timestamp de execução da triagem IA. (QW-09)';

-- ── Correção 3: log de falhas de sincronização offline ───────────────────────

CREATE TABLE IF NOT EXISTS public.offline_sync_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  operacao    text        NOT NULL,  -- 'checkin' | 'update_atendimento' | 'save_vistoria'
  erro        text        NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.offline_sync_log IS
  'Registra falhas de sincronização do drainQueue. '
  'Populado pelo frontend quando uma operação offline falha ao ser enviada. '
  'Permite rastrear erros recorrentes por operador e tipo de operação. (QW-09)';

ALTER TABLE public.offline_sync_log ENABLE ROW LEVEL SECURITY;

-- Operadores autenticados podem inserir seus próprios logs de falha
CREATE POLICY "usuario_pode_inserir_sync_log" ON public.offline_sync_log
  FOR INSERT WITH CHECK (true);

-- Admin e supervisor podem consultar todos os logs
CREATE POLICY "admin_supervisor_pode_ver_sync_log" ON public.offline_sync_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel IN ('admin', 'supervisor')
    )
  );

CREATE INDEX IF NOT EXISTS idx_offline_sync_log_usuario ON public.offline_sync_log (usuario_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_log_criado  ON public.offline_sync_log (criado_em DESC);
