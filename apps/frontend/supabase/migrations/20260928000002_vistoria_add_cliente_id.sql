-- =============================================================================
-- FIX: Adiciona cliente_id (denormalizado) em vistoria_riscos,
--      vistoria_depositos e vistoria_calhas.
--
-- Contexto: as tabelas foram criadas sem cliente_id mas o código e as políticas
-- RLS posteriores (M08) precisam dele para isolamento eficiente por cliente.
-- =============================================================================

-- ── vistoria_riscos ───────────────────────────────────────────────────────────
ALTER TABLE public.vistoria_riscos
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE;

UPDATE public.vistoria_riscos r
SET cliente_id = v.cliente_id
FROM public.vistorias v
WHERE r.vistoria_id = v.id AND r.cliente_id IS NULL;

ALTER TABLE public.vistoria_riscos
  ALTER COLUMN cliente_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vistoria_riscos_cliente_id ON public.vistoria_riscos (cliente_id);

-- RLS
DROP POLICY IF EXISTS "vistoria_riscos_isolamento" ON public.vistoria_riscos;
DROP POLICY IF EXISTS "vistoria_riscos_select"     ON public.vistoria_riscos;
DROP POLICY IF EXISTS "vistoria_riscos_insert"     ON public.vistoria_riscos;
DROP POLICY IF EXISTS "vistoria_riscos_update"     ON public.vistoria_riscos;
DROP POLICY IF EXISTS "vistoria_riscos_delete"     ON public.vistoria_riscos;

CREATE POLICY "vistoria_riscos_select" ON public.vistoria_riscos
  FOR SELECT TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_riscos_insert" ON public.vistoria_riscos
  FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_riscos_update" ON public.vistoria_riscos
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_riscos_delete" ON public.vistoria_riscos
  FOR DELETE TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));

-- ── vistoria_depositos ────────────────────────────────────────────────────────
ALTER TABLE public.vistoria_depositos
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE;

UPDATE public.vistoria_depositos d
SET cliente_id = v.cliente_id
FROM public.vistorias v
WHERE d.vistoria_id = v.id AND d.cliente_id IS NULL;

ALTER TABLE public.vistoria_depositos
  ALTER COLUMN cliente_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vistoria_depositos_cliente_id ON public.vistoria_depositos (cliente_id);

-- RLS
DROP POLICY IF EXISTS "vistoria_depositos_isolamento" ON public.vistoria_depositos;
DROP POLICY IF EXISTS "vistoria_depositos_select"     ON public.vistoria_depositos;
DROP POLICY IF EXISTS "vistoria_depositos_insert"     ON public.vistoria_depositos;
DROP POLICY IF EXISTS "vistoria_depositos_update"     ON public.vistoria_depositos;
DROP POLICY IF EXISTS "vistoria_depositos_delete"     ON public.vistoria_depositos;

CREATE POLICY "vistoria_depositos_select" ON public.vistoria_depositos
  FOR SELECT TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_depositos_insert" ON public.vistoria_depositos
  FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_depositos_update" ON public.vistoria_depositos
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_depositos_delete" ON public.vistoria_depositos
  FOR DELETE TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));

-- ── vistoria_calhas ───────────────────────────────────────────────────────────
ALTER TABLE public.vistoria_calhas
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE;

UPDATE public.vistoria_calhas c
SET cliente_id = v.cliente_id
FROM public.vistorias v
WHERE c.vistoria_id = v.id AND c.cliente_id IS NULL;

ALTER TABLE public.vistoria_calhas
  ALTER COLUMN cliente_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vistoria_calhas_cliente_id ON public.vistoria_calhas (cliente_id);

-- RLS
DROP POLICY IF EXISTS "vistoria_calhas_isolamento" ON public.vistoria_calhas;
DROP POLICY IF EXISTS "vistoria_calhas_select"     ON public.vistoria_calhas;
DROP POLICY IF EXISTS "vistoria_calhas_insert"     ON public.vistoria_calhas;
DROP POLICY IF EXISTS "vistoria_calhas_update"     ON public.vistoria_calhas;
DROP POLICY IF EXISTS "vistoria_calhas_delete"     ON public.vistoria_calhas;

CREATE POLICY "vistoria_calhas_select" ON public.vistoria_calhas
  FOR SELECT TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_calhas_insert" ON public.vistoria_calhas
  FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_calhas_update" ON public.vistoria_calhas
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_calhas_delete" ON public.vistoria_calhas
  FOR DELETE TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));
