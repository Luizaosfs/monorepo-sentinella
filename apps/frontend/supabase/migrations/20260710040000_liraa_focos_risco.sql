-- ─────────────────────────────────────────────────────────────────────────────
-- AUX-4 — Enriquecer rpc_calcular_liraa com dados de focos_risco
-- Adiciona ao resultado existente:
--   focos_detectados_drone   — focos com origem_tipo='drone' no ciclo
--   focos_confirmados        — focos com status='confirmado' ou 'em_tratamento'
--   focos_resolvidos         — focos com status='resolvido' no ciclo
--   taxa_resolucao_focos_pct — resolvidos / (confirmados + em_tratamento + resolvidos)
--   focos_por_prioridade     — contagem por P1..P5
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_calcular_liraa(
  p_cliente_id uuid,
  p_ciclo      integer
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      v.id                                                    AS vistoria_id,
      v.imovel_id,
      v.data_visita,
      v.acesso_realizado,
      COALESCE(SUM(d.qtd_inspecionados), 0)                  AS total_recipientes,
      COALESCE(SUM(d.qtd_com_focos), 0)                      AS recipientes_com_foco,
      COALESCE(SUM(CASE WHEN d.qtd_com_focos > 0 THEN 1 ELSE 0 END), 0) AS tipos_foco
    FROM vistorias v
    LEFT JOIN vistoria_depositos d ON d.vistoria_id = v.id
    WHERE v.cliente_id = p_cliente_id
      AND v.ciclo = p_ciclo
      AND v.tipo_atividade = 'liraa'
    GROUP BY v.id
  ),
  por_tipo AS (
    SELECT
      v.id AS vistoria_id,
      d.tipo,
      SUM(d.qtd_inspecionados) AS inspecionados,
      SUM(d.qtd_com_focos)     AS com_foco
    FROM vistorias v
    JOIN vistoria_depositos d ON d.vistoria_id = v.id
    WHERE v.cliente_id = p_cliente_id
      AND v.ciclo = p_ciclo
      AND v.tipo_atividade = 'liraa'
    GROUP BY v.id, d.tipo
  ),
  totais AS (
    SELECT
      COUNT(*)                                                    AS total_imoveis,
      COUNT(*) FILTER (WHERE acesso_realizado = true)             AS inspecionados,
      COUNT(*) FILTER (WHERE acesso_realizado = false)            AS fechados,
      COUNT(*) FILTER (WHERE recipientes_com_foco > 0)           AS imoveis_com_foco,
      SUM(recipientes_com_foco)                                   AS total_recipientes_foco,
      SUM(total_recipientes)                                      AS total_recipientes
    FROM base
  ),
  por_deposito AS (
    SELECT
      tipo,
      SUM(inspecionados) AS inspecionados,
      SUM(com_foco)      AS com_foco,
      ROUND(
        CASE WHEN SUM(inspecionados) > 0
          THEN SUM(com_foco)::numeric / SUM(inspecionados) * 100
          ELSE 0 END, 2
      ) AS indice
    FROM por_tipo
    GROUP BY tipo
  ),
  -- ── focos_risco para este ciclo e cliente ───────────────────────────────────
  focos AS (
    SELECT
      fr.id,
      fr.status,
      fr.prioridade,
      fr.origem_tipo
    FROM focos_risco fr
    WHERE fr.cliente_id = p_cliente_id
      AND fr.ciclo      = p_ciclo
  ),
  focos_totais AS (
    SELECT
      COUNT(*) FILTER (WHERE origem_tipo = 'drone')                               AS detectados_drone,
      COUNT(*) FILTER (WHERE status IN ('confirmado', 'em_tratamento'))           AS confirmados,
      COUNT(*) FILTER (WHERE status = 'resolvido')                                AS resolvidos,
      COUNT(*) FILTER (WHERE status = 'descartado')                               AS descartados,
      COUNT(*) FILTER (WHERE prioridade = 'P1')                                   AS p1,
      COUNT(*) FILTER (WHERE prioridade = 'P2')                                   AS p2,
      COUNT(*) FILTER (WHERE prioridade = 'P3')                                   AS p3,
      COUNT(*) FILTER (WHERE prioridade = 'P4')                                   AS p4,
      COUNT(*) FILTER (WHERE prioridade = 'P5')                                   AS p5
    FROM focos
  )
  SELECT jsonb_build_object(
    'ciclo',               p_ciclo,
    'total_imoveis',       t.total_imoveis,
    'inspecionados',       t.inspecionados,
    'fechados',            t.fechados,
    'iip',                 ROUND(CASE WHEN t.inspecionados > 0
                             THEN t.imoveis_com_foco::numeric / t.inspecionados * 100
                             ELSE 0 END, 2),
    'ib',                  ROUND(CASE WHEN t.inspecionados > 0
                             THEN t.total_recipientes_foco::numeric / t.inspecionados * 100
                             ELSE 0 END, 2),
    'imoveis_com_foco',    t.imoveis_com_foco,
    'total_recipientes_foco', t.total_recipientes_foco,
    'classificacao_risco', CASE
      WHEN ROUND(CASE WHEN t.inspecionados > 0
           THEN t.imoveis_com_foco::numeric / t.inspecionados * 100
           ELSE 0 END, 2) < 1   THEN 'satisfatório'
      WHEN ROUND(CASE WHEN t.inspecionados > 0
           THEN t.imoveis_com_foco::numeric / t.inspecionados * 100
           ELSE 0 END, 2) < 3.9 THEN 'alerta'
      ELSE 'risco'
    END,
    'por_deposito',        (SELECT jsonb_agg(row_to_json(d)) FROM por_deposito d),
    -- ── dados de focos_risco ──────────────────────────────────────────────────
    'focos_detectados_drone',   ft.detectados_drone,
    'focos_confirmados',        ft.confirmados,
    'focos_resolvidos',         ft.resolvidos,
    'focos_descartados',        ft.descartados,
    'taxa_resolucao_focos_pct', ROUND(
      CASE WHEN (ft.confirmados + ft.resolvidos) > 0
        THEN ft.resolvidos::numeric / (ft.confirmados + ft.resolvidos) * 100
        ELSE 0 END, 1
    ),
    'focos_por_prioridade', jsonb_build_object(
      'P1', ft.p1,
      'P2', ft.p2,
      'P3', ft.p3,
      'P4', ft.p4,
      'P5', ft.p5
    )
  )
  FROM totais t
  CROSS JOIN focos_totais ft;
$$;
