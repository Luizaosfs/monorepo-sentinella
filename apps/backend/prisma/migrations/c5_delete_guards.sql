-- =============================================================================
-- Fase C.5 — Guards DELETE LGPD (defesa em profundidade)
-- Porte das 3 triggers BEFORE DELETE do Supabase legado (QW-10A + QW-10D)
--
-- Tabelas protegidas (NUNCA hard delete):
--   - clientes  → sempre bloqueia (QW-10A)
--   - imoveis   → bloqueia se houver vistorias vinculadas (QW-10D)
--   - vistorias → sempre bloqueia (QW-10D)
--
-- Para cleanup em ambiente de teste, usar:
--   SET LOCAL session_replication_role = replica;
--   DELETE FROM ...;
--   SET LOCAL session_replication_role = DEFAULT;
-- Essa cláusula desabilita triggers apenas na transação atual.
-- =============================================================================

-- ── 1. fn_bloquear_delete_cliente ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_bloquear_delete_cliente()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    '[QW-10A] DELETE fisico em clientes e bloqueado. '
    'Use: UPDATE clientes SET ativo = false, deleted_at = now() WHERE id = ''%''',
    OLD.id;
END;
$$;

COMMENT ON FUNCTION public.fn_bloquear_delete_cliente() IS
  'Impede exclusão física de clientes. Toda desativação deve usar soft delete '
  '(ativo = false + deleted_at = now()). Defesa LGPD. (C.5 + QW-10A)';

DROP TRIGGER IF EXISTS trg_bloquear_delete_cliente ON public.clientes;
CREATE TRIGGER trg_bloquear_delete_cliente
  BEFORE DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete_cliente();

-- ── 2. fn_bloquear_delete_imovel ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_bloquear_delete_imovel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM vistorias WHERE imovel_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION
      'Imóvel com vistorias não pode ser apagado. Use deleted_at = now() para inativação.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.fn_bloquear_delete_imovel() IS
  'Impede exclusão de imóveis com vistorias vinculadas. '
  'Imóveis sem histórico podem ser deletados (limpeza de cadastros errados). (C.5 + QW-10D)';

DROP TRIGGER IF EXISTS trg_bloquear_delete_imovel ON public.imoveis;
CREATE TRIGGER trg_bloquear_delete_imovel
  BEFORE DELETE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete_imovel();

-- ── 3. fn_bloquear_delete_vistoria ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_bloquear_delete_vistoria()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Vistorias não podem ser apagadas. Use deleted_at = now() para inativação.'
    USING ERRCODE = 'P0001';
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.fn_bloquear_delete_vistoria() IS
  'Impede exclusão física de vistorias. Dados de saúde pública são imutáveis. (C.5 + QW-10D)';

DROP TRIGGER IF EXISTS trg_bloquear_delete_vistoria ON public.vistorias;
CREATE TRIGGER trg_bloquear_delete_vistoria
  BEFORE DELETE ON public.vistorias
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete_vistoria();
