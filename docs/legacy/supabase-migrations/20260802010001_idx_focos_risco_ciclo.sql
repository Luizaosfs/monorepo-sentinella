-- =============================================================================
-- 3B: Índices de performance para focos_risco por ciclo e responsável
--
-- Problema: consultas de GestorFocos, GestorMapa e CentralOperacional fazem
-- full-scan em focos_risco filtrando por cliente_id + ciclo ou responsavel_id.
-- Sem índices, cada query de painel varre toda a tabela.
-- =============================================================================

-- Índice principal para listagem/filtro por cliente e ciclo
CREATE INDEX IF NOT EXISTS idx_focos_risco_cliente_ciclo
  ON public.focos_risco (cliente_id, ciclo)
  WHERE deleted_at IS NULL;

-- Índice para fila do responsável (agente vê seus focos)
CREATE INDEX IF NOT EXISTS idx_focos_risco_responsavel
  ON public.focos_risco (responsavel_id, status)
  WHERE deleted_at IS NULL AND responsavel_id IS NOT NULL;

-- Índice para filtro por origem_tipo (canal cidadão, drone, agente)
CREATE INDEX IF NOT EXISTS idx_focos_risco_origem_tipo
  ON public.focos_risco (cliente_id, origem_tipo, status)
  WHERE deleted_at IS NULL;

-- Índice para busca por imóvel (score, central operacional)
CREATE INDEX IF NOT EXISTS idx_focos_risco_imovel
  ON public.focos_risco (imovel_id, status)
  WHERE deleted_at IS NULL AND imovel_id IS NOT NULL;

-- Índice geoespacial para consultas de raio (cruzamento casos↔focos)
CREATE INDEX IF NOT EXISTS idx_focos_risco_geo
  ON public.focos_risco USING GIST (
    ST_MakePoint(longitude, latitude)
  )
  WHERE deleted_at IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;
