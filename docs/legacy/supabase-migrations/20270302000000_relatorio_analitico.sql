-- ─────────────────────────────────────────────────────────────────────────────
-- P8.3 — Relatórios Automáticos e Executivos
-- 1. Tabela relatorios_gerados (histórico)
-- 2. RPC rpc_gerar_relatorio_analitico (dados para o relatório)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. TABELA HISTÓRICO DE RELATÓRIOS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.relatorios_gerados (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  gerado_por    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  periodo_inicio date       NOT NULL,
  periodo_fim    date       NOT NULL,
  payload       jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.relatorios_gerados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relatorios_select_por_cliente" ON public.relatorios_gerados
  FOR SELECT USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "relatorios_insert_por_cliente" ON public.relatorios_gerados
  FOR INSERT WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE INDEX ON public.relatorios_gerados (cliente_id, created_at DESC);

COMMENT ON TABLE public.relatorios_gerados IS
  'Histórico de relatórios analíticos gerados. payload = JSON completo do relatório. RLS por usuario_pode_acessar_cliente. P8.3.';

-- ── 2. RPC: rpc_gerar_relatorio_analitico ────────────────────────────────────
-- Agrega dados de vistorias + imoveis com filtro de período.
-- Retorna JSON completo para geração do relatório executivo.
-- SECURITY INVOKER — RLS das tabelas base aplicado automaticamente.

CREATE OR REPLACE FUNCTION public.rpc_gerar_relatorio_analitico(
  p_cliente_id    uuid,
  p_periodo_inicio date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_periodo_fim   date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_municipio               text;
  v_cidade                  text;
  v_uf                      text;
  v_resumo                  jsonb;
  v_risco_territorial       jsonb;
  v_vulnerabilidade         jsonb;
  v_alerta_saude            jsonb;
  v_resultado_operacional   jsonb;
  v_imoveis_criticos        jsonb;
BEGIN
  -- Dados do município
  SELECT nome, cidade, uf::text
    INTO v_municipio, v_cidade, v_uf
    FROM public.clientes
   WHERE id = p_cliente_id;

  -- ── Resumo geral ──────────────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'total_vistorias',          COUNT(*),
    'p1_count',                 COUNT(*) FILTER (WHERE v.prioridade_final = 'P1'),
    'p2_count',                 COUNT(*) FILTER (WHERE v.prioridade_final = 'P2'),
    'p3_count',                 COUNT(*) FILTER (WHERE v.prioridade_final = 'P3'),
    'p4_count',                 COUNT(*) FILTER (WHERE v.prioridade_final = 'P4'),
    'visitados_count',          COUNT(*) FILTER (WHERE v.resultado_operacional = 'visitado'),
    'sem_acesso_count',         COUNT(*) FILTER (WHERE v.resultado_operacional = 'sem_acesso'),
    'sem_acesso_retorno_count', COUNT(*) FILTER (WHERE v.resultado_operacional = 'sem_acesso_retorno'),
    'taxa_acesso_pct',          ROUND(
      100.0 * COUNT(*) FILTER (WHERE v.resultado_operacional = 'visitado')
      / NULLIF(COUNT(*) FILTER (WHERE v.resultado_operacional IS NOT NULL), 0),
    1),
    'alertas_urgentes',         COUNT(*) FILTER (WHERE v.alerta_saude = 'urgente'),
    'alertas_atencao',          COUNT(*) FILTER (WHERE v.alerta_saude = 'atencao'),
    'vulnerabilidade_alta_count', COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar IN ('alta','critica')),
    'vulnerabilidade_critica_count', COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar = 'critica'),
    'risco_vetorial_alto_count', COUNT(*) FILTER (WHERE v.risco_vetorial IN ('alto','critico')),
    'risco_socio_alto_count',   COUNT(*) FILTER (WHERE v.risco_socioambiental = 'alto')
  )
  INTO v_resumo
  FROM public.vistorias v
  WHERE v.cliente_id = p_cliente_id
    AND v.deleted_at IS NULL
    AND v.data_visita::date BETWEEN p_periodo_inicio AND p_periodo_fim;

  -- ── Risco territorial por bairro ──────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'criticos_count')::int DESC NULLS LAST), '[]'::jsonb)
  INTO v_risco_territorial
  FROM (
    SELECT jsonb_build_object(
      'bairro',              COALESCE(im.bairro, '(sem bairro)'),
      'total_vistorias',     COUNT(*),
      'criticos_count',      COUNT(*) FILTER (WHERE v.prioridade_final IN ('P1','P2')),
      'risco_vetorial_alto', COUNT(*) FILTER (WHERE v.risco_vetorial IN ('alto','critico')),
      'vulnerabilidade_alta',COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar IN ('alta','critica')),
      'alertas_saude',       COUNT(*) FILTER (WHERE v.alerta_saude IN ('atencao','urgente')),
      'alertas_urgentes',    COUNT(*) FILTER (WHERE v.alerta_saude = 'urgente'),
      'sem_acesso_total',    COUNT(*) FILTER (WHERE v.resultado_operacional IN ('sem_acesso','sem_acesso_retorno')),
      'pct_criticos',        ROUND(
        100.0 * COUNT(*) FILTER (WHERE v.prioridade_final IN ('P1','P2'))
        / NULLIF(COUNT(*), 0),
      1)
    ) AS row
    FROM public.vistorias v
    JOIN public.imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
    WHERE v.cliente_id = p_cliente_id
      AND v.deleted_at IS NULL
      AND v.data_visita::date BETWEEN p_periodo_inicio AND p_periodo_fim
    GROUP BY im.bairro
  ) sub;

  -- ── Vulnerabilidade domiciliar ────────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'total')::int DESC NULLS LAST), '[]'::jsonb)
  INTO v_vulnerabilidade
  FROM (
    SELECT jsonb_build_object(
      'vulnerabilidade_domiciliar', v.vulnerabilidade_domiciliar,
      'total', COUNT(*)
    ) AS row
    FROM public.vistorias v
    WHERE v.cliente_id = p_cliente_id
      AND v.deleted_at IS NULL
      AND v.vulnerabilidade_domiciliar IS NOT NULL
      AND v.data_visita::date BETWEEN p_periodo_inicio AND p_periodo_fim
    GROUP BY v.vulnerabilidade_domiciliar
  ) sub;

  -- ── Alerta de saúde ───────────────────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'total')::int DESC NULLS LAST), '[]'::jsonb)
  INTO v_alerta_saude
  FROM (
    SELECT jsonb_build_object(
      'alerta_saude', v.alerta_saude,
      'total', COUNT(*)
    ) AS row
    FROM public.vistorias v
    WHERE v.cliente_id = p_cliente_id
      AND v.deleted_at IS NULL
      AND v.alerta_saude IS NOT NULL
      AND v.data_visita::date BETWEEN p_periodo_inicio AND p_periodo_fim
    GROUP BY v.alerta_saude
  ) sub;

  -- ── Resultado operacional ─────────────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'total')::int DESC NULLS LAST), '[]'::jsonb)
  INTO v_resultado_operacional
  FROM (
    SELECT jsonb_build_object(
      'resultado_operacional', v.resultado_operacional,
      'total', COUNT(*)
    ) AS row
    FROM public.vistorias v
    WHERE v.cliente_id = p_cliente_id
      AND v.deleted_at IS NULL
      AND v.resultado_operacional IS NOT NULL
      AND v.data_visita::date BETWEEN p_periodo_inicio AND p_periodo_fim
    GROUP BY v.resultado_operacional
  ) sub;

  -- ── Imóveis críticos P1/P2 (máx. 50) ─────────────────────────────────────
  SELECT COALESCE(jsonb_agg(
    row ORDER BY
      (row->>'dimensoes_criticas_count')::int DESC NULLS LAST,
      row->>'prioridade_final',
      row->>'data_visita' DESC
  ), '[]'::jsonb)
  INTO v_imoveis_criticos
  FROM (
    SELECT jsonb_build_object(
      'logradouro',              im.logradouro,
      'numero',                  im.numero,
      'bairro',                  COALESCE(im.bairro, '(sem bairro)'),
      'prioridade_final',        v.prioridade_final,
      'prioridade_motivo',       v.prioridade_motivo,
      'resultado_operacional',   v.resultado_operacional,
      'vulnerabilidade_domiciliar', v.vulnerabilidade_domiciliar,
      'alerta_saude',            v.alerta_saude,
      'risco_socioambiental',    v.risco_socioambiental,
      'risco_vetorial',          v.risco_vetorial,
      'data_visita',             v.data_visita::date,
      'dimensoes_criticas_count', (
        CASE WHEN v.risco_vetorial           IN ('alto','critico')    THEN 1 ELSE 0 END +
        CASE WHEN v.vulnerabilidade_domiciliar IN ('alta','critica')   THEN 1 ELSE 0 END +
        CASE WHEN v.alerta_saude              IN ('atencao','urgente') THEN 1 ELSE 0 END +
        CASE WHEN v.risco_socioambiental     = 'alto'                 THEN 1 ELSE 0 END
      )
    ) AS row
    FROM public.vistorias v
    JOIN public.imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
    WHERE v.cliente_id = p_cliente_id
      AND v.deleted_at IS NULL
      AND v.prioridade_final IN ('P1','P2')
      AND v.data_visita::date BETWEEN p_periodo_inicio AND p_periodo_fim
    LIMIT 50
  ) sub;

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'municipio',      v_municipio,
      'cidade',         v_cidade,
      'uf',             v_uf,
      'periodo_inicio', p_periodo_inicio,
      'periodo_fim',    p_periodo_fim,
      'gerado_em',      now()
    ),
    'resumo',               COALESCE(v_resumo, '{}'::jsonb),
    'risco_territorial',    v_risco_territorial,
    'vulnerabilidade',      v_vulnerabilidade,
    'alerta_saude',         v_alerta_saude,
    'resultado_operacional', v_resultado_operacional,
    'imoveis_criticos',     v_imoveis_criticos
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_gerar_relatorio_analitico(uuid, date, date) IS
  'P8.3 — Consolida dados analíticos de vistoria com filtro de período para geração de relatório executivo. SECURITY INVOKER — RLS de vistorias e imoveis aplicado. Retorna JSON completo.';

GRANT EXECUTE ON FUNCTION public.rpc_gerar_relatorio_analitico(uuid, date, date) TO authenticated;
