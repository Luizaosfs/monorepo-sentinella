-- QW-17 Sprint C — Cursor pagination para casos_notificados
--
-- Problema: api.casosNotificados.list carrega todos os registros sem LIMIT.
-- Com 10k+ casos, a query full-scan degrada e o payload HTTP é enorme.
--
-- Solução:
--   1. Índice composto (cliente_id, created_at DESC) — fast cursor seek
--   2. RPC fn_casos_notificados_page — paginação por cursor (keyset pagination)
--      Retorna até p_limit registros após o cursor, com flag has_more.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Índice composto para queries de paginação ordenada por cliente+data.
CREATE INDEX IF NOT EXISTS idx_casos_notificados_cliente_created
  ON casos_notificados (cliente_id, created_at DESC);

COMMENT ON INDEX idx_casos_notificados_cliente_created IS
  'QW-17C: acelera cursor pagination por cliente ordenado por data.';

-- 2. RPC de paginação cursor-based.
--    p_cursor_created_at = NULL → primeira página (registros mais recentes)
--    p_cursor_id         = NULL → ignorado se cursor_created_at for NULL
--    Retorna p_limit + 1 registros; o chamador detecta has_more se count = p_limit+1.
CREATE OR REPLACE FUNCTION fn_casos_notificados_page(
  p_cliente_id      uuid,
  p_limit           int     DEFAULT 100,
  p_cursor_created  timestamptz DEFAULT NULL,
  p_cursor_id       uuid    DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  cliente_id          uuid,
  unidade_saude_id    uuid,
  notificador_id      uuid,
  doenca              text,
  status              text,
  data_inicio_sintomas date,
  data_notificacao    date,
  logradouro_bairro   text,
  bairro              text,
  latitude            float8,
  longitude           float8,
  regiao_id           uuid,
  observacao          text,
  payload             jsonb,
  created_at          timestamptz,
  updated_at          timestamptz,
  -- joins desnormalizados para evitar round-trip extra
  unidade_nome        text,
  unidade_tipo        text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.cliente_id,
    c.unidade_saude_id,
    c.notificador_id,
    c.doenca::text,
    c.status::text,
    c.data_inicio_sintomas,
    c.data_notificacao,
    c.logradouro_bairro,
    c.bairro,
    c.latitude,
    c.longitude,
    c.regiao_id,
    c.observacao,
    c.payload,
    c.created_at,
    c.updated_at,
    u.nome  AS unidade_nome,
    u.tipo::text AS unidade_tipo
  FROM casos_notificados c
  LEFT JOIN unidades_saude u ON u.id = c.unidade_saude_id
  WHERE c.cliente_id = p_cliente_id
    AND (
      p_cursor_created IS NULL
      OR c.created_at < p_cursor_created
      OR (c.created_at = p_cursor_created AND c.id < p_cursor_id)
    )
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT p_limit + 1;  -- +1 para detectar has_more no chamador
$$;

COMMENT ON FUNCTION fn_casos_notificados_page(uuid, int, timestamptz, uuid) IS
  'QW-17C: keyset pagination para casos_notificados. '
  'Retorna p_limit+1 linhas; se count = p_limit+1 há próxima página. '
  'cursor = (created_at, id) do último item da página anterior.';

GRANT EXECUTE ON FUNCTION fn_casos_notificados_page(uuid, int, timestamptz, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION fn_casos_notificados_page(uuid, int, timestamptz, uuid)
  TO service_role;
