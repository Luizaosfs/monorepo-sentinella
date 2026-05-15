-- Notificador: persistir a quadra resolvida geoespacialmente (lat/long -> bairros_quadras)
-- no caso notificado. bairro_id já existe. Idempotente.

ALTER TABLE public.casos_notificados
  ADD COLUMN IF NOT EXISTS quadra_id uuid;

CREATE INDEX IF NOT EXISTS casos_notificados_quadra_id_idx
  ON public.casos_notificados (quadra_id);
