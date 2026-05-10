-- Refactoring bairros_distribuicao: ciclo (int) + quarteirao (text) → ciclo_id (UUID FK) + quadra_id (UUID FK)
-- Tabelas estão vazias (0 rows em 2026-05-10), sem migração de dados necessária.

-- 1. Adiciona novas colunas FK
ALTER TABLE public.bairros_distribuicao
  ADD COLUMN ciclo_id  UUID REFERENCES public.ciclos(id)          ON DELETE RESTRICT,
  ADD COLUMN quadra_id UUID REFERENCES public.bairros_quadras(id) ON DELETE RESTRICT;

-- 2. Remove constraint única antiga
ALTER TABLE public.bairros_distribuicao
  DROP CONSTRAINT IF EXISTS bairros_distribuicao_cliente_id_ciclo_quarteirao_key;

-- 3. Adiciona nova constraint única
ALTER TABLE public.bairros_distribuicao
  ADD CONSTRAINT bairros_distribuicao_cliente_id_ciclo_id_quadra_id_key
    UNIQUE (cliente_id, ciclo_id, quadra_id);

-- 4. Remove colunas antigas (tabela vazia, seguro)
ALTER TABLE public.bairros_distribuicao
  DROP COLUMN IF EXISTS ciclo,
  DROP COLUMN IF EXISTS quarteirao;

-- 5. Índices de desempenho nas novas FKs
CREATE INDEX IF NOT EXISTS idx_bairros_dist_ciclo_id  ON public.bairros_distribuicao (ciclo_id);
CREATE INDEX IF NOT EXISTS idx_bairros_dist_quadra_id ON public.bairros_distribuicao (quadra_id);
