-- Govern distribuicao mutations: create audit history table.
-- Apply with: psql $DATABASE_URL -f prisma/migrations/distribuicao_governance.sql
-- Then run: pnpm generate

CREATE TABLE IF NOT EXISTS public.bairros_distribuicao_historico (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID        NOT NULL,
  ciclo_id   UUID        NOT NULL,
  quadra_id  UUID        NOT NULL,
  agente_id  UUID,
  acao       TEXT        NOT NULL CHECK (acao IN ('criada', 'atribuida', 'excluida', 'copiada')),
  usuario_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dist_hist_ciclo_id   ON public.bairros_distribuicao_historico(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_dist_hist_quadra_id  ON public.bairros_distribuicao_historico(quadra_id);
CREATE INDEX IF NOT EXISTS idx_dist_hist_cliente_id ON public.bairros_distribuicao_historico(cliente_id);
