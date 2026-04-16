-- ─────────────────────────────────────────────────────────────────────────────
-- GRUPO 2 — Performance: índices geoespaciais e de consulta frequente
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.1  Índice geoespacial em casos_notificados (PostGIS)
-- Usado pelo trigger trg_cruzar_caso_focos e pela RPC listar_casos_no_raio
CREATE INDEX IF NOT EXISTS idx_casos_notificados_geo
  ON casos_notificados USING GIST (ST_MakePoint(longitude, latitude))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Índice composto para filtros frequentes na tela admin (cliente + data)
CREATE INDEX IF NOT EXISTS idx_casos_notificados_cliente_data
  ON casos_notificados (cliente_id, data_notificacao DESC);

-- 2.2  Índice geoespacial em levantamento_itens (já usado por ST_DWithin no trigger)
CREATE INDEX IF NOT EXISTS idx_levantamento_itens_geo
  ON levantamento_itens USING GIST (ST_MakePoint(longitude, latitude))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 2.3  Índice em sla_operacional para consultas de itens próximos do vencimento
CREATE INDEX IF NOT EXISTS idx_sla_operacional_status_prazo
  ON sla_operacional (status, prazo_final)
  WHERE status NOT IN ('resolvido', 'descartado');

-- 2.4  Índice em vistorias para consultas por agente + ciclo
CREATE INDEX IF NOT EXISTS idx_vistorias_agente_ciclo
  ON vistorias (cliente_id, agente_id, ciclo);
