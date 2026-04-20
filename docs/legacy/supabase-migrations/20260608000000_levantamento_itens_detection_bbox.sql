-- Migration: adiciona coluna detection_bbox em levantamento_itens
-- Corresponde ao commit do sentinela (Python): 009_levantamento_itens_detection_bbox.sql
-- Já aplicada no Supabase. Esta migration garante rastreabilidade no repositório web.

ALTER TABLE public.levantamento_itens
  ADD COLUMN IF NOT EXISTS detection_bbox jsonb NULL;

COMMENT ON COLUMN public.levantamento_itens.detection_bbox IS
  'Caixa de detecção YOLO principal: { bbox_xyxy: [x1,y1,x2,y2], bbox_norm: [nx1,ny1,nx2,ny2], image_width, image_height }. '
  'Null para itens manuais, análises anteriores ou confiança abaixo do limiar.';
