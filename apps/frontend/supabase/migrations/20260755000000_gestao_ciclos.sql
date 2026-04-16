-- =============================================================================
-- Gestão de Ciclos Epidemiológicos
--
-- O ciclo bimestral JÁ EXISTE implicitamente no banco (via coluna ciclo 1–6
-- em vistorias, focos_risco, distribuicao_quarteirao). Esta migration adiciona
-- uma camada de GOVERNANÇA: um registro formal por ciclo por cliente, com
-- status, meta, datas e snapshot de fechamento.
--
-- IMPORTANTE: Esta tabela NÃO substitui as colunas ciclo existentes.
-- Ela adiciona metadados de gestão sobre elas.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ciclos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  numero           int         NOT NULL CHECK (numero BETWEEN 1 AND 6),
  ano              int         NOT NULL CHECK (ano >= 2020),
  status           text        NOT NULL DEFAULT 'planejamento'
                     CHECK (status IN ('planejamento', 'ativo', 'fechado')),
  -- Datas reais (podem diferir do calendário — ex: ciclo adiado por chuvas)
  data_inicio      date        NOT NULL,
  data_fim_prevista date       NOT NULL,
  data_fechamento  date,        -- preenchido ao fechar
  -- Meta de cobertura (% de imóveis a visitar)
  meta_cobertura_pct numeric(5,2) DEFAULT 100.0 CHECK (meta_cobertura_pct BETWEEN 0 AND 100),
  -- Snapshot imutável gerado ao fechar o ciclo
  snapshot_fechamento jsonb,    -- resultado de rpc_calcular_liraa + métricas gerais
  -- Observações do supervisor ao abrir/fechar
  observacao_abertura text,
  observacao_fechamento text,
  -- Auditoria
  aberto_por       uuid        REFERENCES usuarios(id),
  fechado_por      uuid        REFERENCES usuarios(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- Um ciclo por número por ano por cliente
  UNIQUE (cliente_id, numero, ano)
);

COMMENT ON TABLE public.ciclos IS
  'Registro formal de gestão dos ciclos bimestrais (1–6) por cliente. '
  'Complementa as colunas ciclo em vistorias/focos_risco — não as substitui. '
  'Permite acompanhar status (planejamento/ativo/fechado), meta de cobertura '
  'e snapshot de indicadores ao fechar.';

ALTER TABLE public.ciclos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ciclos_select" ON public.ciclos
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "ciclos_insert_update" ON public.ciclos
  FOR ALL TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE INDEX idx_ciclos_cliente ON public.ciclos (cliente_id, ano DESC, numero DESC);
CREATE INDEX idx_ciclos_status  ON public.ciclos (cliente_id, status)
  WHERE status = 'ativo';

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION fn_ciclos_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_ciclos_updated_at
  BEFORE UPDATE ON public.ciclos
  FOR EACH ROW EXECUTE FUNCTION fn_ciclos_updated_at();

-- =============================================================================
-- RPC: abrir_ciclo
-- Valida pré-condições, cria registro, registra quem abriu
-- =============================================================================
CREATE OR REPLACE FUNCTION public.abrir_ciclo(
  p_cliente_id         uuid,
  p_numero             int,
  p_ano                int DEFAULT NULL,
  p_meta_cobertura_pct numeric DEFAULT 100.0,
  p_observacao         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano          int := COALESCE(p_ano, EXTRACT(YEAR FROM now())::int);
  v_ciclo_id     uuid;
  v_user_id      uuid;
  v_data_inicio  date;
  v_data_fim     date;
  v_ja_ativo     boolean;
BEGIN
  -- Verificar permissão
  IF NOT public.usuario_pode_acessar_cliente(p_cliente_id) THEN
    RAISE EXCEPTION 'abrir_ciclo: sem permissão para este cliente';
  END IF;

  -- Verificar se já existe ciclo ativo para este cliente
  SELECT EXISTS (
    SELECT 1 FROM public.ciclos
    WHERE cliente_id = p_cliente_id AND status = 'ativo'
  ) INTO v_ja_ativo;

  IF v_ja_ativo THEN
    RAISE EXCEPTION 'abrir_ciclo: já existe um ciclo ativo. Feche-o antes de abrir um novo.';
  END IF;

  -- Calcular datas padrão do bimestre
  v_data_inicio := make_date(v_ano, (p_numero - 1) * 2 + 1, 1);
  v_data_fim    := (make_date(v_ano, LEAST(p_numero * 2, 12), 1)
                    + interval '1 month - 1 day')::date;

  -- Resolver usuário autenticado
  SELECT id INTO v_user_id
  FROM public.usuarios WHERE auth_id = auth.uid();

  -- Criar ou atualizar o ciclo para 'ativo'
  INSERT INTO public.ciclos (
    cliente_id, numero, ano, status,
    data_inicio, data_fim_prevista,
    meta_cobertura_pct, observacao_abertura,
    aberto_por
  ) VALUES (
    p_cliente_id, p_numero, v_ano, 'ativo',
    v_data_inicio, v_data_fim,
    p_meta_cobertura_pct, p_observacao,
    v_user_id
  )
  ON CONFLICT (cliente_id, numero, ano)
  DO UPDATE SET
    status               = 'ativo',
    meta_cobertura_pct   = EXCLUDED.meta_cobertura_pct,
    observacao_abertura  = EXCLUDED.observacao_abertura,
    aberto_por           = EXCLUDED.aberto_por,
    data_fechamento      = NULL,
    snapshot_fechamento  = NULL,
    fechado_por          = NULL
  RETURNING id INTO v_ciclo_id;

  RETURN jsonb_build_object(
    'ok',           true,
    'ciclo_id',     v_ciclo_id,
    'numero',       p_numero,
    'ano',          v_ano,
    'data_inicio',  v_data_inicio,
    'data_fim',     v_data_fim
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.abrir_ciclo(uuid, int, int, numeric, text) TO authenticated;
COMMENT ON FUNCTION public.abrir_ciclo IS
  'Abre formalmente um ciclo bimestral. Exige que não haja outro ciclo ativo. '
  'Registra aberto_por, datas e meta de cobertura.';

-- =============================================================================
-- RPC: fechar_ciclo
-- Gera snapshot de indicadores, marca como fechado
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fechar_ciclo(
  p_cliente_id      uuid,
  p_numero          int,
  p_ano             int DEFAULT NULL,
  p_observacao      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano        int := COALESCE(p_ano, EXTRACT(YEAR FROM now())::int);
  v_ciclo      public.ciclos%ROWTYPE;
  v_user_id    uuid;
  v_liraa      jsonb;
  v_snapshot   jsonb;
  v_vistorias  int;
  v_focos_res  int;
  v_focos_tot  int;
  v_cobertura  numeric;
  v_imoveis    int;
BEGIN
  IF NOT public.usuario_pode_acessar_cliente(p_cliente_id) THEN
    RAISE EXCEPTION 'fechar_ciclo: sem permissão para este cliente';
  END IF;

  SELECT * INTO v_ciclo
  FROM public.ciclos
  WHERE cliente_id = p_cliente_id AND numero = p_numero AND ano = v_ano;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fechar_ciclo: ciclo %/% não encontrado', p_numero, v_ano;
  END IF;

  IF v_ciclo.status = 'fechado' THEN
    RAISE EXCEPTION 'fechar_ciclo: ciclo já está fechado';
  END IF;

  SELECT id INTO v_user_id FROM public.usuarios WHERE auth_id = auth.uid();

  -- Gerar snapshot de indicadores
  v_liraa := public.rpc_calcular_liraa(p_cliente_id, p_numero);

  SELECT COUNT(*) INTO v_focos_tot
  FROM public.focos_risco
  WHERE cliente_id = p_cliente_id AND ciclo = p_numero AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_focos_res
  FROM public.focos_risco
  WHERE cliente_id = p_cliente_id AND ciclo = p_numero
    AND status = 'resolvido' AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_imoveis
  FROM public.imoveis
  WHERE cliente_id = p_cliente_id AND ativo = true AND deleted_at IS NULL;

  SELECT COUNT(DISTINCT imovel_id) INTO v_vistorias
  FROM public.vistorias
  WHERE cliente_id = p_cliente_id AND ciclo = p_numero
    AND acesso_realizado = true AND deleted_at IS NULL;

  v_cobertura := CASE WHEN v_imoveis > 0
    THEN ROUND((v_vistorias::numeric / v_imoveis) * 100, 1)
    ELSE 0 END;

  v_snapshot := jsonb_build_object(
    'fechado_em',           now(),
    'total_vistorias',      v_vistorias,
    'total_imoveis',        v_imoveis,
    'cobertura_pct',        v_cobertura,
    'total_focos',          v_focos_tot,
    'focos_resolvidos',     v_focos_res,
    'taxa_resolucao_pct',   CASE WHEN v_focos_tot > 0
      THEN ROUND((v_focos_res::numeric / v_focos_tot) * 100, 1) ELSE 0 END,
    'liraa',                v_liraa
  );

  UPDATE public.ciclos SET
    status                = 'fechado',
    data_fechamento       = CURRENT_DATE,
    snapshot_fechamento   = v_snapshot,
    observacao_fechamento = p_observacao,
    fechado_por           = v_user_id
  WHERE cliente_id = p_cliente_id AND numero = p_numero AND ano = v_ano;

  RETURN jsonb_build_object(
    'ok',       true,
    'numero',   p_numero,
    'ano',      v_ano,
    'snapshot', v_snapshot
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fechar_ciclo(uuid, int, int, text) TO authenticated;
COMMENT ON FUNCTION public.fechar_ciclo IS
  'Fecha um ciclo bimestral: gera snapshot de LIRAa + indicadores e marca como fechado. '
  'O snapshot é imutável após fechamento.';

-- =============================================================================
-- View: ciclo ativo do cliente logado
-- =============================================================================
CREATE OR REPLACE VIEW public.v_ciclo_ativo
WITH (security_invoker = true) AS
SELECT
  c.*,
  CASE
    WHEN c.id IS NOT NULL THEN c.numero
    ELSE CEIL((EXTRACT(MONTH FROM now())::numeric + 1) / 2)::int
  END AS ciclo_numero_efetivo,
  CASE
    WHEN c.data_inicio IS NOT NULL AND c.data_fim_prevista IS NOT NULL
      THEN ROUND(
        100.0 * (CURRENT_DATE - c.data_inicio)
        / NULLIF(c.data_fim_prevista - c.data_inicio, 0), 1
      )
    ELSE NULL
  END AS pct_tempo_decorrido
FROM public.usuarios u
LEFT JOIN public.ciclos c
  ON c.cliente_id = u.cliente_id
  AND c.status = 'ativo'
WHERE u.auth_id = auth.uid();

GRANT SELECT ON public.v_ciclo_ativo TO authenticated;
COMMENT ON VIEW public.v_ciclo_ativo IS
  'Ciclo ativo do cliente do usuário logado. Retorna 1 row (NULL se sem ciclo formal ativo). '
  'ciclo_numero_efetivo: usa o ciclo formal se ativo, senão calcula pelo calendário.';

-- =============================================================================
-- View: progresso do ciclo ativo
-- =============================================================================
CREATE OR REPLACE VIEW public.v_ciclo_progresso
WITH (security_invoker = true) AS
WITH ciclo_ref AS (
  SELECT
    u.cliente_id,
    COALESCE(
      (SELECT numero FROM public.ciclos
       WHERE cliente_id = u.cliente_id AND status = 'ativo' LIMIT 1),
      CEIL((EXTRACT(MONTH FROM now())::numeric + 1) / 2)::int
    ) AS ciclo
  FROM public.usuarios u
  WHERE u.auth_id = auth.uid()
)
SELECT
  cr.cliente_id,
  cr.ciclo,
  COUNT(DISTINCT im.id)                                        AS imoveis_total,
  COUNT(DISTINCT v.imovel_id)
    FILTER (WHERE v.acesso_realizado = true)                   AS imoveis_visitados,
  COUNT(DISTINCT v.imovel_id)
    FILTER (WHERE v.acesso_realizado = false)                  AS imoveis_sem_acesso,
  ROUND(
    100.0 * COUNT(DISTINCT v.imovel_id) FILTER (WHERE v.acesso_realizado = true)
    / NULLIF(COUNT(DISTINCT im.id), 0), 1
  )                                                            AS cobertura_pct,
  COUNT(DISTINCT v.id)                                         AS vistorias_total,
  COUNT(DISTINCT v.id) FILTER (WHERE v.tipo_atividade = 'liraa') AS vistorias_liraa,
  COUNT(DISTINCT v.agente_id)                                  AS agentes_ativos,
  COUNT(DISTINCT fr.id)                                        AS focos_total,
  COUNT(DISTINCT fr.id)
    FILTER (WHERE fr.status NOT IN ('resolvido','descartado')) AS focos_ativos,
  COUNT(DISTINCT fr.id)
    FILTER (WHERE fr.status = 'resolvido')                     AS focos_resolvidos,
  COUNT(DISTINCT ar.id)
    FILTER (WHERE ar.resolvido = false)                        AS alertas_retorno_pendentes
FROM ciclo_ref cr
JOIN public.clientes cl ON cl.id = cr.cliente_id
LEFT JOIN public.imoveis im
  ON im.cliente_id = cr.cliente_id AND im.ativo = true AND im.deleted_at IS NULL
LEFT JOIN public.vistorias v
  ON v.imovel_id = im.id AND v.ciclo = cr.ciclo AND v.deleted_at IS NULL
LEFT JOIN public.focos_risco fr
  ON fr.cliente_id = cr.cliente_id AND fr.ciclo = cr.ciclo AND fr.deleted_at IS NULL
LEFT JOIN public.alerta_retorno_imovel ar
  ON ar.cliente_id = cr.cliente_id AND ar.ciclo = cr.ciclo
GROUP BY cr.cliente_id, cr.ciclo;

GRANT SELECT ON public.v_ciclo_progresso TO authenticated;
COMMENT ON VIEW public.v_ciclo_progresso IS
  'Progresso do ciclo ativo: cobertura, vistorias, focos e alertas. '
  'Usa ciclo formal se existir, senão calcula pelo calendário. security_invoker = true.';
