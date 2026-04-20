-- 20270201000003 — Atualiza chk_papel_canonico para incluir analista_regional
--
-- PRÉ-REQUISITO: 20270201000000 aplicada (analista_regional adicionado ao enum papel_app)
--
-- O constraint anterior só permitia: admin, supervisor, agente, notificador.
-- Esta migration expande para incluir analista_regional.

ALTER TABLE public.papeis_usuarios
  DROP CONSTRAINT IF EXISTS chk_papel_canonico;

ALTER TABLE public.papeis_usuarios
  ADD CONSTRAINT chk_papel_canonico
  CHECK (papel::text = ANY (ARRAY['admin', 'supervisor', 'agente', 'notificador', 'analista_regional']));
