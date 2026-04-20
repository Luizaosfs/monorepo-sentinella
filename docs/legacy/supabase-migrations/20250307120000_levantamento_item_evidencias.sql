-- =============================================================================
-- EVIDÊNCIAS DO ATENDIMENTO POR ITEM (Meus itens)
-- Tabela levantamento_item_evidencias: fotos/legenda anexadas ao item no painel
-- de detalhes. Acesso via levantamento_itens -> levantamentos -> cliente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.levantamento_item_evidencias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  levantamento_item_id uuid NOT NULL,
  image_url text NOT NULL,
  legenda text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT levantamento_item_evidencias_pkey PRIMARY KEY (id),
  CONSTRAINT levantamento_item_evidencias_item_fkey FOREIGN KEY (levantamento_item_id)
    REFERENCES public.levantamento_itens(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_levantamento_item_evidencias_item_id
  ON public.levantamento_item_evidencias(levantamento_item_id);

COMMENT ON TABLE public.levantamento_item_evidencias IS
  'Evidências fotográficas do atendimento anexadas pelo operador no painel de detalhes do item (Meus itens).';

-- -----------------------------------------------------------------------------
-- RLS (acesso via levantamento_itens -> levantamentos -> usuario_pode_acessar_cliente)
-- -----------------------------------------------------------------------------
ALTER TABLE public.levantamento_item_evidencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "levantamento_item_evidencias_select" ON public.levantamento_item_evidencias;
CREATE POLICY "levantamento_item_evidencias_select" ON public.levantamento_item_evidencias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.levantamento_itens li
      JOIN public.levantamentos l ON l.id = li.levantamento_id
      WHERE li.id = levantamento_item_evidencias.levantamento_item_id
      AND public.usuario_pode_acessar_cliente(l.cliente_id)
    )
  );

DROP POLICY IF EXISTS "levantamento_item_evidencias_insert" ON public.levantamento_item_evidencias;
CREATE POLICY "levantamento_item_evidencias_insert" ON public.levantamento_item_evidencias
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.levantamento_itens li
      JOIN public.levantamentos l ON l.id = li.levantamento_id
      WHERE li.id = levantamento_item_evidencias.levantamento_item_id
      AND public.usuario_pode_acessar_cliente(l.cliente_id)
    )
  );

DROP POLICY IF EXISTS "levantamento_item_evidencias_update" ON public.levantamento_item_evidencias;
CREATE POLICY "levantamento_item_evidencias_update" ON public.levantamento_item_evidencias
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.levantamento_itens li
      JOIN public.levantamentos l ON l.id = li.levantamento_id
      WHERE li.id = levantamento_item_evidencias.levantamento_item_id
      AND public.usuario_pode_acessar_cliente(l.cliente_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.levantamento_itens li
      JOIN public.levantamentos l ON l.id = li.levantamento_id
      WHERE li.id = levantamento_item_evidencias.levantamento_item_id
      AND public.usuario_pode_acessar_cliente(l.cliente_id)
    )
  );

DROP POLICY IF EXISTS "levantamento_item_evidencias_delete" ON public.levantamento_item_evidencias;
CREATE POLICY "levantamento_item_evidencias_delete" ON public.levantamento_item_evidencias
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.levantamento_itens li
      JOIN public.levantamentos l ON l.id = li.levantamento_id
      WHERE li.id = levantamento_item_evidencias.levantamento_item_id
      AND public.usuario_pode_acessar_cliente(l.cliente_id)
    )
  );
