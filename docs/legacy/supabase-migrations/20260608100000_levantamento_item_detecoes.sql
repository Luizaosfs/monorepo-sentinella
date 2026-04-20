-- Migration: tabela levantamento_item_detecoes
-- Uma linha por detecção YOLO por foto (todas as caixas, não só a principal).
-- A detecção principal permanece em levantamento_itens.detection_bbox.
-- Já aplicada no Supabase (010_levantamento_item_detecoes.sql no repositório Python).
-- Esta migration garante rastreabilidade no repositório web.

CREATE TABLE IF NOT EXISTS public.levantamento_item_detecoes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  levantamento_item_id   uuid NOT NULL REFERENCES public.levantamento_itens(id) ON DELETE CASCADE,
  ordem                  smallint NOT NULL DEFAULT 0,
  class_name             text NOT NULL,
  confidence             double precision NULL,
  bbox_xyxy              jsonb NULL,
  bbox_norm              jsonb NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lid_item ON public.levantamento_item_detecoes (levantamento_item_id);

ALTER TABLE public.levantamento_item_detecoes ENABLE ROW LEVEL SECURITY;

-- SELECT: mesmo cliente do levantamento pai
CREATE POLICY "lid_select" ON public.levantamento_item_detecoes
  FOR SELECT USING (
    levantamento_item_id IN (
      SELECT li.id FROM public.levantamento_itens li
      JOIN public.levantamentos l ON l.id = li.levantamento_id
      WHERE l.cliente_id IN (
        SELECT cliente_id FROM public.usuarios WHERE auth_id = auth.uid()
      )
    )
  );

-- INSERT/DELETE: dono do levantamento
CREATE POLICY "lid_insert" ON public.levantamento_item_detecoes
  FOR INSERT WITH CHECK (
    levantamento_item_id IN (
      SELECT li.id FROM public.levantamento_itens li
      JOIN public.levantamentos l ON l.id = li.levantamento_id
      WHERE l.usuario_id IN (
        SELECT id FROM public.usuarios WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "lid_delete" ON public.levantamento_item_detecoes
  FOR DELETE USING (
    levantamento_item_id IN (
      SELECT li.id FROM public.levantamento_itens li
      JOIN public.levantamentos l ON l.id = li.levantamento_id
      WHERE l.usuario_id IN (
        SELECT id FROM public.usuarios WHERE auth_id = auth.uid()
      )
    )
  );

COMMENT ON TABLE public.levantamento_item_detecoes IS
  'Todas as detecções YOLO por foto. A detecção principal de negócio fica em levantamento_itens.detection_bbox.';
