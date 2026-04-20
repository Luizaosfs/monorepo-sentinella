-- Gaps identificados na revisao do spec completo:
-- 1. v_foco_risco_timeline corrigida em 20260710060000 (caracteres Unicode em literais)
-- 2. v_focos_risco_analytics + rpc_resumo_regional
-- 3. operacoes.foco_risco_id FK
-- 4. COMMENT ON TABLE levantamento_itens

-- Adicionar foco_risco_id em operacoes (necessario para timeline tipo='acao')

ALTER TABLE operacoes
  ADD COLUMN IF NOT EXISTS foco_risco_id uuid REFERENCES focos_risco(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operacoes_foco_risco
  ON operacoes (foco_risco_id) WHERE foco_risco_id IS NOT NULL;

-- View analitica v_focos_risco_analytics

CREATE OR REPLACE VIEW v_focos_risco_analytics
WITH (security_invoker = true)
AS
SELECT
  fr.id,
  fr.cliente_id,
  fr.imovel_id,
  fr.regiao_id,
  r.regiao AS regiao_nome,
  fr.status,
  fr.prioridade,
  fr.origem_tipo,
  fr.ciclo,
  fr.latitude,
  fr.longitude,
  fr.endereco_normalizado,
  fr.suspeita_em,
  fr.confirmado_em,
  fr.resolvido_em,
  fr.foco_anterior_id,
  fr.casos_ids,
  CASE
    WHEN fr.resolvido_em IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (fr.resolvido_em - fr.suspeita_em)) / 3600.0, 2)
    ELSE NULL
  END AS tempo_total_horas,
  CASE
    WHEN fr.resolvido_em IS NOT NULL AND sla.prazo_final IS NOT NULL
      THEN fr.resolvido_em <= sla.prazo_final
    ELSE NULL
  END AS sla_cumprido,
  CASE
    WHEN fr.resolvido_em IS NOT NULL AND sla.inicio IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (fr.resolvido_em - sla.inicio)) / 3600.0, 2)
    ELSE NULL
  END AS sla_horas_utilizadas,
  sla.prazo_final AS sla_prazo_em,
  sla.violado AS sla_violado,
  sla.prioridade AS sla_prioridade,
  (fr.foco_anterior_id IS NOT NULL) AS eh_reincidencia,
  COALESCE((
    SELECT COUNT(*)
      FROM focos_risco fr2
     WHERE fr2.imovel_id = fr.imovel_id
       AND fr2.cliente_id = fr.cliente_id
       AND fr2.id <> fr.id
  ), 0) AS total_focos_no_imovel,
  array_length(fr.casos_ids, 1) AS total_casos_proximos,
  fr.created_at,
  fr.updated_at
FROM focos_risco fr
LEFT JOIN regioes r ON r.id = fr.regiao_id
LEFT JOIN sla_operacional sla
  ON sla.foco_risco_id = fr.id
 AND sla.status NOT IN ('concluido', 'vencido');

COMMENT ON VIEW v_focos_risco_analytics IS
  'View analitica de focos_risco com campos calculados: tempo_total_horas, sla_cumprido, '
  'sla_horas_utilizadas, eh_reincidencia, total_focos_no_imovel, total_casos_proximos. '
  'Filtrar por suspeita_em para recortes temporais. security_invoker = true.';

-- RPC rpc_resumo_regional

CREATE OR REPLACE FUNCTION rpc_resumo_regional(
  p_cliente_id uuid,
  p_ciclo      integer     DEFAULT NULL,
  p_de         timestamptz DEFAULT NULL,
  p_ate        timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    WITH focos AS (
      SELECT
        fr.regiao_id,
        r.regiao AS regiao_nome,
        fr.status,
        fr.origem_tipo,
        fr.resolvido_em,
        fr.suspeita_em,
        fr.confirmado_em,
        sla.prazo_final,
        sla.violado AS sla_violado
      FROM focos_risco fr
      LEFT JOIN regioes r ON r.id = fr.regiao_id
      LEFT JOIN sla_operacional sla ON sla.foco_risco_id = fr.id
      WHERE fr.cliente_id = p_cliente_id
        AND (p_ciclo IS NULL OR fr.ciclo = p_ciclo)
        AND (p_de    IS NULL OR fr.suspeita_em >= p_de)
        AND (p_ate   IS NULL OR fr.suspeita_em <= p_ate)
    ),
    por_regiao AS (
      SELECT
        regiao_id,
        regiao_nome,
        COUNT(*) AS total_focos,
        COUNT(*) FILTER (WHERE status = 'resolvido') AS focos_resolvidos,
        COUNT(*) FILTER (WHERE status NOT IN ('resolvido','descartado')) AS focos_ativos,
        COUNT(*) FILTER (WHERE status = 'descartado') AS focos_descartados,
        ROUND(
          CASE WHEN COUNT(*) FILTER (WHERE origem_tipo = 'drone') > 0
            THEN COUNT(*) FILTER (WHERE origem_tipo = 'drone' AND status = 'descartado')::numeric
                 / COUNT(*) FILTER (WHERE origem_tipo = 'drone') * 100
            ELSE 0 END, 1
        ) AS taxa_falso_positivo_drone,
        ROUND(AVG(
          CASE WHEN resolvido_em IS NOT NULL
            THEN EXTRACT(EPOCH FROM (resolvido_em - COALESCE(confirmado_em, suspeita_em))) / 3600.0
          END
        )::numeric, 2) AS media_tempo_tratamento_horas,
        COUNT(*) FILTER (WHERE sla_violado = true) AS sla_violado_count
      FROM focos
      GROUP BY regiao_id, regiao_nome
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'regiao_id',                    regiao_id,
        'regiao_nome',                  regiao_nome,
        'total_focos',                  total_focos,
        'focos_resolvidos',             focos_resolvidos,
        'focos_ativos',                 focos_ativos,
        'focos_descartados',            focos_descartados,
        'taxa_falso_positivo_drone',    taxa_falso_positivo_drone,
        'media_tempo_tratamento_horas', media_tempo_tratamento_horas,
        'sla_violado_count',            sla_violado_count
      )
      ORDER BY total_focos DESC
    )
    FROM por_regiao
  );
END;
$$;

COMMENT ON FUNCTION rpc_resumo_regional IS
  'Resumo agregado por regiao: total/resolvidos/ativos/descartados, '
  'taxa de falso positivo drone, media de tempo de tratamento, SLA violados. '
  'Filtros: p_ciclo (opcional), p_de/p_ate (intervalo em suspeita_em).';

-- COMMENT em levantamento_itens

COMMENT ON TABLE levantamento_itens IS
  'Evidencia tecnica imutavel de deteccao (drone ou manual). '
  'Campos tecnicos (EXIF, score, coordenadas) protegidos por trg_bloquear_update_campos_tecnicos. '
  'status_atendimento, acao_aplicada, data_resolucao sao DEPRECATED -- usar focos_risco. '
  'NAO TEM status operacional. Use focos_risco para ciclo de vida.';
