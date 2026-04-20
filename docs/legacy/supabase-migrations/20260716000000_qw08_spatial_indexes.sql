-- QW-08 Índices espaciais e otimizações de mapa
--
-- Problema: idx_levantamento_itens_geo e idx_casos_notificados_geo foram criados
-- em 20260319240000 como GIST(geometry). As queries usam ::geography, então o
-- planner NUNCA usa esses índices. A migration 20260604000000 tentou corrigir
-- com IF NOT EXISTS mas foi silenciosamente ignorada (nome já existia).
--
-- Correção: DROP + CREATE com o tipo correto (geography).
--
-- NOTA: CREATE INDEX CONCURRENTLY não pode rodar dentro de transação.
-- Esta migration usa CREATE INDEX simples, que é adequado para migrations de
-- deploy. Em produção com tabela muito grande e live traffic, prefira rodar
-- manualmente: DROP INDEX CONCURRENTLY; CREATE INDEX CONCURRENTLY.
--
-- Correção 1: levantamento_itens — substituir geometry por geography
-- Correção 2: casos_notificados  — substituir geometry por geography
-- Correção 3: imoveis            — criar índice GIST (nunca teve)

-- ── Correção 1: levantamento_itens ───────────────────────────────────────────

-- Dropa o índice geometry criado em 20260319240000 (nunca usado por queries ::geography)
DROP INDEX IF EXISTS idx_levantamento_itens_geo;

-- Recria como geography — compatível com ST_DWithin(::geography, ::geography, metros)
-- Partial index: exclui linhas sem coordenadas (NULL → menos bloat, build mais rápido)
CREATE INDEX IF NOT EXISTS idx_levantamento_itens_geo
  ON public.levantamento_itens
  USING GIST ((ST_MakePoint(longitude, latitude)::geography))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON INDEX idx_levantamento_itens_geo IS
  'Índice GIST geography para ST_DWithin em triggers e RPCs espaciais. '
  'Substitui o índice geometry de 20260319240000 que era invisível ao planner. (QW-08)';

-- ── Correção 2: casos_notificados ────────────────────────────────────────────

-- Dropa o índice geometry criado em 20260319240000
DROP INDEX IF EXISTS idx_casos_notificados_geo;

-- Recria como geography — compatível com fn_cruzar_caso_com_focos, listar_casos_no_raio
CREATE INDEX IF NOT EXISTS idx_casos_notificados_geo
  ON public.casos_notificados
  USING GIST ((ST_MakePoint(longitude, latitude)::geography))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON INDEX idx_casos_notificados_geo IS
  'Índice GIST geography para ST_DWithin em trigger e RPC listar_casos_no_raio. '
  'Substitui o índice geometry de 20260319240000 que era invisível ao planner. (QW-08)';

-- O índice B-tree (cliente_id, latitude, longitude) da 20250318000000 é mantido:
-- útil para filtros exatos de bounding-box e para filtrar por cliente antes do GIST.

-- ── Correção 3: imoveis ───────────────────────────────────────────────────────

-- imoveis nunca teve índice GIST — fn_vincular_imovel_automatico usa ST_DWithin(30m)
-- a cada novo foco_risco inserido, fazendo full scan de imoveis por foco.
CREATE INDEX IF NOT EXISTS idx_imoveis_geo
  ON public.imoveis
  USING GIST ((ST_MakePoint(longitude, latitude)::geography))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON INDEX idx_imoveis_geo IS
  'Índice GIST geography para ST_DWithin em fn_vincular_imovel_automatico (raio 30m). '
  'Elimina full scan de imoveis a cada foco_risco inserido. (QW-08)';
