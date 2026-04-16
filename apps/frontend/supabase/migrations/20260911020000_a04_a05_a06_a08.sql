-- =============================================================================
-- A04: updated_at em operacoes
-- A05: Remover campos redundantes de clientes
-- A06: Drop trigger de histórico de status (coluna removida)
-- A08: Adicionar usuarios.ativo
-- =============================================================================

-- ── A04: updated_at em operacoes ─────────────────────────────────────────────
ALTER TABLE public.operacoes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.trg_operacoes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operacoes_updated_at ON public.operacoes;
CREATE TRIGGER trg_operacoes_updated_at
  BEFORE UPDATE ON public.operacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_operacoes_updated_at();

-- ── A05: Remover campos redundantes de clientes ───────────────────────────────

-- Garantir que ibge_municipio tem os dados de codigo_ibge antes de dropar
UPDATE public.clientes
SET ibge_municipio = codigo_ibge
WHERE ibge_municipio IS NULL AND codigo_ibge IS NOT NULL;

ALTER TABLE public.clientes DROP COLUMN IF EXISTS codigo_ibge;

-- 'estado' redundante com 'uf' — migrar e deprecar
UPDATE public.clientes
SET uf = LEFT(estado, 2)
WHERE uf IS NULL AND estado IS NOT NULL;

COMMENT ON COLUMN public.clientes.estado IS
  'DEPRECATED — usar uf como fonte de verdade. '
  'Mantido apenas para exibição de endereço completo.';

-- ── A06: Drop trigger de histórico que monitora coluna removida ───────────────
-- trg_levantamento_item_status_historico monitora status_atendimento (removida em 20260711)
DROP TRIGGER IF EXISTS trg_levantamento_item_status_historico ON public.levantamento_itens;

COMMENT ON TABLE public.levantamento_item_status_historico IS
  'DEPRECATED — histórico de status_atendimento (coluna removida em 20260711). '
  'Dados antigos preservados para referência. '
  'Novas transições são registradas em foco_risco_historico.';

-- ── A08: Adicionar usuarios.ativo ─────────────────────────────────────────────
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_usuarios_cliente_ativo
  ON public.usuarios (cliente_id) WHERE ativo = true;

COMMENT ON COLUMN public.usuarios.ativo IS
  'A08: Flag de usuário ativo. Usuários desativados não devem fazer login. '
  'Usar em vez de DELETE para preservar histórico de auditorias.';
