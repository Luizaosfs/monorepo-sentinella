-- Soft delete: módulos restantes (complemento ao QW-10A e QW-10D)
-- Tabelas: levantamentos, planejamento, vistoria_sintomas, vistoria_riscos, vistoria_calhas, sla_operacional

ALTER TABLE public.levantamentos
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES public.usuarios(id);

ALTER TABLE public.planejamento
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES public.usuarios(id);

ALTER TABLE public.vistoria_sintomas
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;

ALTER TABLE public.vistoria_riscos
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;

ALTER TABLE public.vistoria_calhas
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;

ALTER TABLE public.sla_operacional
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES public.usuarios(id);

-- Índices parciais para filtros de soft delete eficientes
CREATE INDEX IF NOT EXISTS idx_levantamentos_deleted_at
  ON public.levantamentos (deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_planejamento_deleted_at
  ON public.planejamento (deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sla_operacional_deleted_at
  ON public.sla_operacional (deleted_at) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON COLUMN public.levantamentos.deleted_at   IS 'Soft delete (complemento QW-10D).';
COMMENT ON COLUMN public.levantamentos.deleted_by   IS 'Usuário que realizou o soft delete.';
COMMENT ON COLUMN public.planejamento.deleted_at    IS 'Soft delete (complemento QW-10D).';
COMMENT ON COLUMN public.planejamento.deleted_by    IS 'Usuário que realizou o soft delete.';
COMMENT ON COLUMN public.sla_operacional.deleted_at IS 'Soft delete (complemento QW-10D).';
COMMENT ON COLUMN public.sla_operacional.deleted_by IS 'Usuário que realizou o soft delete.';
