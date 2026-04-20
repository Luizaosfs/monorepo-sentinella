-- =============================================================================
-- P0-6: Adicionar SET search_path = public a todas as funções SECURITY DEFINER
--       que ainda não possuíam essa proteção.
--
-- RISCO SEM ESTA MIGRATION:
--   Funções SECURITY DEFINER sem SET search_path executam com o search_path do
--   chamador. Se um atacante criar um schema com objetos de nome homônimo a
--   funções/tabelas do sistema (ex: uma função pública "md5" num schema pessoal),
--   pode desviar a resolução de nomes dentro de uma função privilegiada.
--   (CVE-pattern: PostgreSQL search_path hijacking in SECURITY DEFINER functions)
--
-- CRITÉRIO DE SELEÇÃO:
--   Apenas funções cujas últimas definições não tinham SET search_path.
--   Funções já corrigidas em migrations anteriores (P0-1 a P0-5, s03, qw14b fix)
--   não são reproduzidas aqui.
--
-- GRUPO 1 — Alta criticidade (leem/escrevem dados sensíveis, criadas por trigger)
-- GRUPO 2 — Média criticidade (operacional, billing, job queue)
-- GRUPO 3 — Baixa criticidade (purge, seed, sync)
-- =============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- GRUPO 1 — Alta criticidade
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1.1 registrar_audit — chamada por get_integracao_api_key e outras RPCs ──
CREATE OR REPLACE FUNCTION public.registrar_audit(
  p_cliente_id  uuid,
  p_acao        text,
  p_tabela      text        DEFAULT NULL,
  p_registro_id uuid        DEFAULT NULL,
  p_descricao   text        DEFAULT NULL,
  p_payload     jsonb       DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_ip_raw     text;
  v_ip_hash    text;
BEGIN
  -- Usuário só pode registrar auditoria do próprio cliente.
  -- Admin pode registrar para qualquer cliente (suporte de plataforma).
  IF p_cliente_id IS NOT NULL
     AND NOT public.usuario_pode_acessar_cliente(p_cliente_id) THEN
    RAISE EXCEPTION
      'registrar_audit: acesso negado — cliente_id não pertence ao usuário';
  END IF;

  SELECT id INTO v_usuario_id
  FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;

  BEGIN
    v_ip_raw := split_part(
      (current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'),
      ',', 1
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip_raw := 'unknown';
  END;

  v_ip_hash := md5(coalesce(nullif(trim(v_ip_raw), ''), 'unknown'));

  INSERT INTO audit_log (
    cliente_id, usuario_id, auth_uid, acao,
    tabela, registro_id, ip_hash, descricao, payload
  ) VALUES (
    p_cliente_id, v_usuario_id, auth.uid(), p_acao,
    p_tabela, p_registro_id, v_ip_hash, p_descricao, p_payload
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_audit(uuid, text, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_audit(uuid, text, text, uuid, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.registrar_audit(uuid, text, text, uuid, text, jsonb) IS
  'Registra ação no audit_log. Valida tenant antes de inserir. '
  'P0-6: SET search_path adicionado para prevenir search_path hijacking.';

-- ── 1.2 listar_casos_no_raio — lê dados sensíveis (casos notificados) ────────
CREATE OR REPLACE FUNCTION public.listar_casos_no_raio(
  p_lat     float8,
  p_lng     float8,
  p_raio    int,
  p_cliente uuid
)
RETURNS SETOF casos_notificados
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM casos_notificados
  WHERE
    cliente_id = p_cliente
    AND status != 'descartado'
    AND latitude  IS NOT NULL
    AND longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(p_lng, p_lat)::geography,
      ST_MakePoint(longitude, latitude)::geography,
      p_raio
    )
  ORDER BY created_at DESC;
$$;

-- ── 1.3 contar_casos_proximos_ao_item — lê cruzamentos caso↔foco ─────────────
CREATE OR REPLACE FUNCTION public.contar_casos_proximos_ao_item(p_item_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM caso_foco_cruzamento
  WHERE levantamento_item_id = p_item_id;
$$;

-- ── 1.4 fn_cruzar_foco_com_casos — trigger: cria cruzamentos ao inserir item ─
CREATE OR REPLACE FUNCTION public.fn_cruzar_foco_com_casos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raio_metros CONSTANT int := 300;
  v_cliente_id uuid;
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT l.cliente_id INTO v_cliente_id
  FROM levantamentos l
  WHERE l.id = NEW.levantamento_id;

  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO caso_foco_cruzamento (caso_id, levantamento_item_id, distancia_metros)
  SELECT
    cn.id,
    NEW.id,
    ST_Distance(
      ST_MakePoint(cn.longitude,  cn.latitude)::geography,
      ST_MakePoint(NEW.longitude, NEW.latitude)::geography
    )
  FROM casos_notificados cn
  WHERE
    cn.cliente_id = v_cliente_id
    AND cn.status  != 'descartado'
    AND cn.latitude  IS NOT NULL
    AND cn.longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(cn.longitude, cn.latitude)::geography,
      ST_MakePoint(NEW.longitude, NEW.latitude)::geography,
      raio_metros
    )
  ON CONFLICT (caso_id, levantamento_item_id) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM caso_foco_cruzamento
    WHERE levantamento_item_id = NEW.id
  ) THEN
    UPDATE levantamento_itens
    SET
      prioridade = 'Crítico',
      payload = jsonb_set(
        COALESCE(payload, '{}'::jsonb),
        '{casos_notificados_proximidade}',
        COALESCE(
          (COALESCE(payload, '{}'::jsonb) -> 'casos_notificados_proximidade'),
          '[]'::jsonb
        ) || (
          SELECT jsonb_agg(to_jsonb(cfc.caso_id::text))
          FROM caso_foco_cruzamento cfc
          WHERE cfc.levantamento_item_id = NEW.id
        )
      )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_cruzar_foco_com_casos() IS
  'D-03: trigger inverso — ao inserir levantamento_item, busca casos_notificados '
  'existentes no raio de 300m e cria cruzamentos retroativos. '
  'P0-6: SET search_path adicionado.';

-- ── 1.5 fn_sintomas_para_caso — trigger: cria caso_notificado a partir de sintomas
CREATE OR REPLACE FUNCTION public.fn_sintomas_para_caso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imovel      imoveis%ROWTYPE;
  v_caso_id     uuid;
  v_unidade_id  uuid;
  v_agente_id   uuid;
BEGIN
  IF NEW.moradores_sintomas_qtd <= 0 THEN
    RETURN NEW;
  END IF;

  -- Integração opcional: só tenta gerar caso se a tabela existir
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'casos_notificados'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT im.*
    INTO v_imovel
  FROM imoveis im
  JOIN vistorias v ON v.imovel_id = im.id
  WHERE v.id = NEW.vistoria_id;

  SELECT v.agente_id
    INTO v_agente_id
  FROM vistorias v
  WHERE v.id = NEW.vistoria_id;

  SELECT us.id
    INTO v_unidade_id
  FROM unidades_saude us
  WHERE us.cliente_id = NEW.cliente_id
    AND us.ativo = true
  ORDER BY
    CASE WHEN us.origem = 'manual' THEN 0 ELSE 1 END,
    us.created_at ASC
  LIMIT 1;

  IF v_unidade_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO casos_notificados (
      cliente_id, unidade_saude_id, notificador_id,
      doenca, status, data_notificacao,
      endereco_paciente, bairro, latitude, longitude, observacao
    )
    VALUES (
      NEW.cliente_id,
      v_unidade_id,
      v_agente_id,
      'suspeito', 'suspeito', CURRENT_DATE,
      COALESCE(v_imovel.logradouro || CASE WHEN v_imovel.numero IS NOT NULL
        THEN ' ' || v_imovel.numero ELSE '' END, ''),
      v_imovel.bairro,
      v_imovel.latitude,
      v_imovel.longitude,
      'Gerado automaticamente por vistoria de campo'
    )
    RETURNING id INTO v_caso_id;

    UPDATE vistoria_sintomas
    SET gerou_caso_notificado_id = v_caso_id
    WHERE id = NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NEW;
  END;

  RETURN NEW;
END;
$$;

-- ── 1.6 fn_falso_positivo_fecha_sla — fecha SLA ao marcar feedback negativo ──
CREATE OR REPLACE FUNCTION public.fn_falso_positivo_fecha_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.confirmado = false AND (OLD.confirmado IS NULL OR OLD.confirmado = true) THEN
    UPDATE sla_operacional
    SET
      status       = 'concluido',
      concluido_em = now()
    WHERE levantamento_item_id = NEW.levantamento_item_id
      AND status NOT IN ('concluido', 'vencido');
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_falso_positivo_fecha_sla() IS
  'E-02: ao marcar yolo_feedback.confirmado=false, fecha sla_operacional aberto '
  'do item. P0-6: SET search_path adicionado.';

-- ── 1.7 fn_casos_notificados_page — keyset pagination para casos ──────────────
CREATE OR REPLACE FUNCTION public.fn_casos_notificados_page(
  p_cliente_id      uuid,
  p_limit           int         DEFAULT 100,
  p_cursor_created  timestamptz DEFAULT NULL,
  p_cursor_id       uuid        DEFAULT NULL
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
  unidade_nome        text,
  unidade_tipo        text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.cliente_id, c.unidade_saude_id, c.notificador_id,
    c.doenca::text, c.status::text,
    c.data_inicio_sintomas, c.data_notificacao,
    c.logradouro_bairro, c.bairro, c.latitude, c.longitude, c.regiao_id,
    c.observacao, c.payload, c.created_at, c.updated_at,
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
  LIMIT p_limit + 1;
$$;

COMMENT ON FUNCTION public.fn_casos_notificados_page(uuid, int, timestamptz, uuid) IS
  'QW-17C: keyset pagination para casos_notificados. '
  'P0-6: SET search_path adicionado.';

GRANT EXECUTE ON FUNCTION public.fn_casos_notificados_page(uuid, int, timestamptz, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_casos_notificados_page(uuid, int, timestamptz, uuid)
  TO service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- GRUPO 2 — Média criticidade (billing, quota, job queue, correlação)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 2.1 cliente_verificar_quota ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cliente_verificar_quota(
  p_cliente_id uuid,
  p_metrica    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usado        numeric;
  v_limite_quota numeric;
  v_limite_plano numeric;
  v_limite       numeric;
  v_mes          timestamptz;
BEGIN
  v_mes := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo');

  SELECT
    CASE p_metrica
      WHEN 'voos_mes'          THEN cq.voos_mes
      WHEN 'levantamentos_mes' THEN cq.levantamentos_mes
      WHEN 'itens_mes'         THEN cq.itens_mes
      WHEN 'usuarios_ativos'   THEN cq.usuarios_ativos
      WHEN 'vistorias_mes'     THEN cq.vistorias_mes
      WHEN 'ia_calls_mes'      THEN cq.ia_calls_mes
      WHEN 'storage_gb'        THEN cq.storage_gb
    END,
    CASE p_metrica
      WHEN 'voos_mes'          THEN pl.limite_voos_mes
      WHEN 'levantamentos_mes' THEN pl.limite_levantamentos_mes
      WHEN 'itens_mes'         THEN NULL
      WHEN 'usuarios_ativos'   THEN pl.limite_usuarios
      WHEN 'vistorias_mes'     THEN pl.limite_vistorias_mes
      WHEN 'ia_calls_mes'      THEN pl.limite_ia_calls_mes
      WHEN 'storage_gb'        THEN pl.limite_storage_gb
    END
  INTO v_limite_quota, v_limite_plano
  FROM cliente_quotas cq
  LEFT JOIN cliente_plano cp ON cp.cliente_id = cq.cliente_id AND cp.status = 'ativo'
  LEFT JOIN planos pl         ON pl.id = cp.plano_id
  WHERE cq.cliente_id = p_cliente_id;

  v_limite := COALESCE(v_limite_quota, v_limite_plano);

  IF p_metrica = 'voos_mes' THEN
    SELECT COUNT(*) INTO v_usado FROM voos
    WHERE cliente_id = p_cliente_id AND created_at >= v_mes;
  ELSIF p_metrica = 'levantamentos_mes' THEN
    SELECT COUNT(*) INTO v_usado FROM levantamentos
    WHERE cliente_id = p_cliente_id AND created_at >= v_mes;
  ELSIF p_metrica = 'itens_mes' THEN
    SELECT COUNT(*) INTO v_usado FROM levantamento_itens li
    JOIN levantamentos lev ON lev.id = li.levantamento_id
    WHERE lev.cliente_id = p_cliente_id AND li.created_at >= v_mes;
  ELSIF p_metrica = 'usuarios_ativos' THEN
    SELECT COUNT(*) INTO v_usado FROM usuarios
    WHERE cliente_id = p_cliente_id AND ativo = true;
  ELSIF p_metrica = 'vistorias_mes' THEN
    SELECT COUNT(*) INTO v_usado FROM vistorias
    WHERE cliente_id = p_cliente_id AND created_at >= v_mes;
  ELSIF p_metrica = 'ia_calls_mes' THEN
    SELECT COUNT(*) INTO v_usado FROM levantamento_analise_ia ia
    JOIN levantamentos lev ON lev.id = ia.levantamento_id
    WHERE lev.cliente_id = p_cliente_id
      AND ia.status = 'sucesso'
      AND ia.created_at >= v_mes;
  ELSIF p_metrica = 'storage_gb' THEN
    SELECT COALESCE(storage_gb, 0) INTO v_usado
    FROM billing_usage_snapshot
    WHERE cliente_id = p_cliente_id ORDER BY periodo_inicio DESC LIMIT 1;
  ELSE
    RAISE EXCEPTION 'metrica_desconhecida: %', p_metrica USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'ok',     v_limite IS NULL OR COALESCE(v_usado, 0) <= v_limite,
    'usado',  COALESCE(v_usado, 0),
    'limite', v_limite
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cliente_verificar_quota(uuid, text) TO authenticated;

-- ── 2.2 fn_check_quota_levantamentos ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_check_quota_levantamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_surto  boolean;
  v_limite numeric;
  v_usado  integer;
  v_mes    timestamptz;
BEGIN
  SELECT surto_ativo INTO v_surto FROM clientes WHERE id = NEW.cliente_id;
  IF COALESCE(v_surto, false) THEN RETURN NEW; END IF;

  SELECT COALESCE(cq.levantamentos_mes, pl.limite_levantamentos_mes)
  INTO v_limite
  FROM cliente_quotas cq
  LEFT JOIN cliente_plano cp ON cp.cliente_id = cq.cliente_id AND cp.status = 'ativo'
  LEFT JOIN planos pl         ON pl.id = cp.plano_id
  WHERE cq.cliente_id = NEW.cliente_id;

  IF v_limite IS NULL THEN RETURN NEW; END IF;

  v_mes := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo');
  SELECT COUNT(*) INTO v_usado FROM levantamentos
  WHERE cliente_id = NEW.cliente_id AND created_at >= v_mes;

  IF v_usado >= (v_limite * 1.5)::int THEN
    RAISE EXCEPTION 'quota_levantamentos_excedida: limite=% usado=% (carencia_150pct)', v_limite, v_usado
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2.3 fn_check_quota_usuarios ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_check_quota_usuarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite numeric;
  v_usado  integer;
BEGIN
  SELECT COALESCE(cq.usuarios_ativos, pl.limite_usuarios)
  INTO v_limite
  FROM cliente_quotas cq
  LEFT JOIN cliente_plano cp ON cp.cliente_id = cq.cliente_id AND cp.status = 'ativo'
  LEFT JOIN planos pl         ON pl.id = cp.plano_id
  WHERE cq.cliente_id = NEW.cliente_id;

  IF v_limite IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_usado FROM usuarios
  WHERE cliente_id = NEW.cliente_id AND ativo = true;

  IF v_usado >= v_limite THEN
    RAISE EXCEPTION 'quota_usuarios_excedida: limite=% usado=%', v_limite, v_usado
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2.4 check_quota_voos ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_quota_voos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite    integer;
  v_utilizado integer;
  v_tz        text := 'America/Sao_Paulo';
BEGIN
  SELECT voos_mes INTO v_limite
  FROM cliente_quotas
  WHERE cliente_id = NEW.cliente_id;

  IF v_limite IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_utilizado
  FROM voos
  WHERE cliente_id = NEW.cliente_id
    AND date_trunc('month', created_at AT TIME ZONE v_tz)
        = date_trunc('month', now()    AT TIME ZONE v_tz);

  IF v_utilizado >= v_limite THEN
    RAISE EXCEPTION
      'Quota de voos mensais atingida (% / %). Entre em contato para ampliar o plano.',
      v_utilizado, v_limite;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_quota_voos() IS
  'F-01: corte de mês em America/Sao_Paulo. P0-6: SET search_path adicionado.';

-- ── 2.5 fn_claim_jobs_round_robin ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_claim_jobs_round_robin(p_max int DEFAULT 5)
RETURNS SETOF job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(id ORDER BY executar_em ASC) INTO v_ids
  FROM (
    SELECT DISTINCT ON (COALESCE(cliente_id::text, 'platform'))
      id, executar_em
    FROM job_queue
    WHERE status     = 'pendente'
      AND executar_em <= now()
    ORDER BY COALESCE(cliente_id::text, 'platform'), executar_em ASC
    LIMIT p_max
  ) candidatos;

  IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
    UPDATE job_queue
       SET status      = 'processando',
           iniciado_em = now()
     WHERE id    = ANY(v_ids)
       AND status = 'pendente'
    RETURNING *;
END;
$$;

COMMENT ON FUNCTION public.fn_claim_jobs_round_robin(int) IS
  'QW-17: aloca até p_max jobs, 1 por cliente, em round-robin. '
  'P0-6: SET search_path adicionado.';

GRANT EXECUTE ON FUNCTION public.fn_claim_jobs_round_robin(int) TO service_role;

-- ── 2.6 fn_correlacionar_vistoria_com_drone ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_correlacionar_vistoria_com_drone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'visitado' AND (OLD.status IS NULL OR OLD.status != 'visitado') THEN
    INSERT INTO vistoria_drone_correlacao (
      vistoria_id, levantamento_item_id, cliente_id, distancia_metros, drone_detectou_foco
    )
    SELECT
      NEW.id,
      li.id,
      NEW.cliente_id,
      ST_Distance(
        ST_MakePoint(im.longitude, im.latitude)::geography,
        ST_MakePoint(li.longitude, li.latitude)::geography
      ),
      (li.risco NOT IN ('sem risco', 'baixo') OR li.risco IS NULL)
    FROM imoveis im
    JOIN levantamento_itens li ON li.cliente_id = NEW.cliente_id
    JOIN levantamentos l       ON l.id = li.levantamento_id
    WHERE im.id = NEW.imovel_id
      AND im.latitude  IS NOT NULL AND im.longitude  IS NOT NULL
      AND li.latitude  IS NOT NULL AND li.longitude  IS NOT NULL
      AND ST_DWithin(
        ST_MakePoint(im.longitude, im.latitude)::geography,
        ST_MakePoint(li.longitude, li.latitude)::geography,
        50
      )
      AND l.created_at >= now() - interval '90 days'
    ON CONFLICT (vistoria_id, levantamento_item_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2.7 fn_refresh_mv_uso_mensal ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_refresh_mv_uso_mensal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cliente_uso_mensal;
END;
$$;

COMMENT ON FUNCTION public.fn_refresh_mv_uso_mensal() IS
  'QW-17B: Atualiza mv_cliente_uso_mensal sem bloquear leituras. '
  'P0-6: SET search_path adicionado.';

GRANT EXECUTE ON FUNCTION public.fn_refresh_mv_uso_mensal() TO service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- GRUPO 3 — Baixa criticidade (seed, sync, quarteirao, purge)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 3.1 fn_seed_score_config ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_seed_score_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.score_config (cliente_id) VALUES (NEW.id)
  ON CONFLICT (cliente_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 3.2 fn_sync_quarteirao_mestre ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_sync_quarteirao_mestre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quarteirao IS NOT NULL AND NEW.quarteirao <> '' THEN
    INSERT INTO quarteiroes (cliente_id, codigo, bairro)
    VALUES (NEW.cliente_id, NEW.quarteirao, NEW.bairro)
    ON CONFLICT (cliente_id, codigo) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3.3 cobertura_quarteirao_ciclo ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cobertura_quarteirao_ciclo(
  p_cliente_id uuid,
  p_ciclo      integer
) RETURNS TABLE (
  quarteirao    text,
  bairro        text,
  agente_id     uuid,
  total_imoveis bigint,
  visitados     bigint,
  pct_cobertura numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.quarteirao,
    MAX(i.bairro) AS bairro,
    d.agente_id,
    COUNT(DISTINCT i.id) AS total_imoveis,
    COUNT(DISTINCT v.imovel_id)
      FILTER (WHERE v.status IN ('visitado', 'fechado')) AS visitados,
    CASE
      WHEN COUNT(DISTINCT i.id) = 0 THEN 0
      ELSE ROUND(
        100.0 * COUNT(DISTINCT v.imovel_id) FILTER (WHERE v.status IN ('visitado', 'fechado'))
        / COUNT(DISTINCT i.id), 1
      )
    END AS pct_cobertura
  FROM distribuicao_quarteirao d
  LEFT JOIN imoveis i
         ON i.cliente_id = d.cliente_id
        AND i.quarteirao = d.quarteirao
        AND i.ativo = true
  LEFT JOIN vistorias v
         ON v.imovel_id = i.id
        AND v.ciclo = p_ciclo
  WHERE d.cliente_id = p_cliente_id
    AND d.ciclo = p_ciclo
  GROUP BY d.quarteirao, d.agente_id
  ORDER BY d.quarteirao;
$$;

-- ── 3.4 copiar_distribuicao_ciclo ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.copiar_distribuicao_ciclo(
  p_cliente_id    uuid,
  p_ciclo_origem  integer,
  p_ciclo_destino integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO distribuicao_quarteirao (cliente_id, ciclo, quarteirao, agente_id, regiao_id)
  SELECT d.cliente_id, p_ciclo_destino, d.quarteirao, d.agente_id, d.regiao_id
  FROM distribuicao_quarteirao d
  WHERE d.cliente_id = p_cliente_id
    AND d.ciclo = p_ciclo_origem
  ON CONFLICT (cliente_id, ciclo, quarteirao) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── 3.5 trg_seed_cliente_plano ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_seed_cliente_plano()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano_basico_id uuid;
BEGIN
  SELECT id INTO v_plano_basico_id FROM planos WHERE nome = 'basico' LIMIT 1;
  IF v_plano_basico_id IS NOT NULL THEN
    INSERT INTO cliente_plano (cliente_id, plano_id)
    VALUES (NEW.id, v_plano_basico_id)
    ON CONFLICT (cliente_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3.6 purgar_audit_log_antigo ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purgar_audit_log_antigo()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM audit_log WHERE created_at < now() - interval '1 year';
$$;

-- ── 3.7 purgar_rate_limit_canal_cidadao ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purgar_rate_limit_canal_cidadao()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM canal_cidadao_rate_limit
  WHERE janela_hora < now() - interval '24 hours';
$$;

-- =============================================================================
-- SUMÁRIO DE RISCOS ELIMINADOS
--
-- GRUPO 1 (Alta criticidade — 7 funções):
--   registrar_audit            — trilha de auditoria; search_path fix impede
--                                desvio de resolução de função md5/insert
--   listar_casos_no_raio       — lê casos_notificados; fix previne shadow de tabela
--   contar_casos_proximos_ao_item — lê caso_foco_cruzamento
--   fn_cruzar_foco_com_casos   — trigger que cria cruzamentos e eleva prioridade
--   fn_sintomas_para_caso      — trigger que cria casos_notificados
--   fn_falso_positivo_fecha_sla — trigger que fecha SLAs
--   fn_casos_notificados_page  — paginação de dados sensíveis
--
-- GRUPO 2 (Média criticidade — 7 funções):
--   cliente_verificar_quota      — lê billing e quotas
--   fn_check_quota_levantamentos — trigger de bloqueio por quota
--   fn_check_quota_usuarios      — trigger de bloqueio por quota
--   check_quota_voos             — trigger de bloqueio por quota
--   fn_claim_jobs_round_robin    — processa job_queue multi-tenant
--   fn_correlacionar_vistoria_com_drone — cria correlações geoespaciais
--   fn_refresh_mv_uso_mensal     — refresh de materialized view
--
-- GRUPO 3 (Baixa criticidade — 6 funções):
--   fn_seed_score_config         — seed ao criar cliente
--   fn_sync_quarteirao_mestre    — sincroniza quarteirões
--   cobertura_quarteirao_ciclo   — relatório de cobertura
--   copiar_distribuicao_ciclo    — copia distribuição entre ciclos
--   trg_seed_cliente_plano       — seed de plano ao criar cliente
--   purgar_audit_log_antigo      — purga logs antigos
--   purgar_rate_limit_canal_cidadao — purga rate limit
-- =============================================================================
