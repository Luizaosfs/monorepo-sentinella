-- QW-15 — Billing: ciclo de faturamento e snapshot mensal de uso

-- ─── 1. Ciclo de faturamento ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_ciclo (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  cliente_plano_id uuid        REFERENCES cliente_plano(id) ON DELETE SET NULL,
  periodo_inicio   date        NOT NULL,
  periodo_fim      date        NOT NULL,
  status           text        NOT NULL DEFAULT 'aberto'
                     CHECK (status IN ('aberto','fechado','faturado','pago','inadimplente')),
  valor_base       numeric(10,2),
  valor_excedente  numeric(10,2) NOT NULL DEFAULT 0,
  valor_total      numeric(10,2),
  nota_fiscal_ref  text,
  pago_em          timestamptz,
  observacao       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, periodo_inicio)
);

COMMENT ON TABLE billing_ciclo IS
  'Ciclo de faturamento mensal por cliente. '
  'Aberto no início do mês, fechado pelo job billing-snapshot no início do mês seguinte.';

ALTER TABLE billing_ciclo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura_admin_billing_ciclo" ON billing_ciclo
  FOR SELECT USING (
    cliente_id IN (
      SELECT u.cliente_id FROM usuarios u
      JOIN papeis_usuarios pu ON pu.usuario_id = u.id
      WHERE u.auth_id = auth.uid()
        AND LOWER(pu.papel::text) IN ('admin','supervisor')
    )
  );
CREATE INDEX IF NOT EXISTS idx_billing_ciclo_cliente ON billing_ciclo (cliente_id, periodo_inicio DESC);

-- ─── 2. Snapshot mensal imutável de uso ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_usage_snapshot (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  billing_ciclo_id      uuid        REFERENCES billing_ciclo(id) ON DELETE SET NULL,
  periodo_inicio        date        NOT NULL,
  periodo_fim           date        NOT NULL,
  -- Métricas de volume
  vistorias_mes         int         NOT NULL DEFAULT 0,
  levantamentos_mes     int         NOT NULL DEFAULT 0,
  itens_focos_mes       int         NOT NULL DEFAULT 0,
  voos_mes              int         NOT NULL DEFAULT 0,
  denuncias_mes         int         NOT NULL DEFAULT 0,
  ia_calls_mes          int         NOT NULL DEFAULT 0,
  relatorios_mes        int         NOT NULL DEFAULT 0,
  syncs_cnes_mes        int         NOT NULL DEFAULT 0,
  notificacoes_esus_mes int         NOT NULL DEFAULT 0,
  usuarios_ativos_mes   int         NOT NULL DEFAULT 0,
  -- Métricas de capacidade
  imoveis_total         int         NOT NULL DEFAULT 0,
  storage_gb            numeric(10,3) NOT NULL DEFAULT 0,
  -- Metadados
  calculado_em          timestamptz NOT NULL DEFAULT now(),
  payload_detalhado     jsonb,
  UNIQUE (cliente_id, periodo_inicio)
);

COMMENT ON TABLE billing_usage_snapshot IS
  'Foto mensal imutável do uso real de cada cliente. '
  'Gerada automaticamente pela Edge Function billing-snapshot no 1º dia do mês.';

ALTER TABLE billing_usage_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura_admin_billing_snapshot" ON billing_usage_snapshot
  FOR SELECT USING (
    cliente_id IN (
      SELECT u.cliente_id FROM usuarios u
      JOIN papeis_usuarios pu ON pu.usuario_id = u.id
      WHERE u.auth_id = auth.uid()
        AND LOWER(pu.papel::text) IN ('admin','supervisor')
    )
  );
CREATE INDEX IF NOT EXISTS idx_billing_snapshot_cliente ON billing_usage_snapshot (cliente_id, periodo_inicio DESC);

-- ─── 3. RPC calcular_uso_mensal ──────────────────────────────────────────────
-- Agrega todas as métricas de uso de um cliente em um período.
-- Chamada pela Edge Function billing-snapshot e pelo painel de uso ao vivo.

CREATE OR REPLACE FUNCTION calcular_uso_mensal(
  p_cliente_id   uuid,
  p_inicio       date,
  p_fim          date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vistorias         int;
  v_levantamentos     int;
  v_itens_focos       int;
  v_voos              int;
  v_denuncias         int;
  v_ia_calls          int;
  v_relatorios        int;
  v_syncs_cnes        int;
  v_notif_esus        int;
  v_usuarios_ativos   int;
  v_imoveis_total     int;
BEGIN
  -- Vistorias criadas no período
  SELECT COUNT(*) INTO v_vistorias
  FROM vistorias
  WHERE cliente_id = p_cliente_id
    AND created_at >= p_inicio AND created_at < p_fim + 1;

  -- Levantamentos criados no período
  SELECT COUNT(*) INTO v_levantamentos
  FROM levantamentos
  WHERE cliente_id = p_cliente_id
    AND created_at >= p_inicio AND created_at < p_fim + 1;

  -- Itens/focos criados no período
  SELECT COUNT(*) INTO v_itens_focos
  FROM levantamento_itens
  WHERE cliente_id = p_cliente_id
    AND created_at >= p_inicio AND created_at < p_fim + 1
    AND deleted_at IS NULL;

  -- Voos realizados no período
  SELECT COUNT(*) INTO v_voos
  FROM voos
  WHERE cliente_id = p_cliente_id
    AND created_at >= p_inicio AND created_at < p_fim + 1;

  -- Denúncias recebidas no período (canal cidadão)
  SELECT COUNT(*) INTO v_denuncias
  FROM levantamento_itens li
  JOIN levantamentos lev ON lev.id = li.levantamento_id
  WHERE lev.cliente_id = p_cliente_id
    AND li.payload->>'fonte' = 'cidadao'
    AND li.created_at >= p_inicio AND li.created_at < p_fim + 1;

  -- Chamadas IA no período
  SELECT COUNT(*) INTO v_ia_calls
  FROM levantamento_analise_ia
  WHERE cliente_id = p_cliente_id
    AND processado_em >= p_inicio AND processado_em < p_fim + 1;

  -- Relatórios gerados no período (via job_queue)
  SELECT COUNT(*) INTO v_relatorios
  FROM job_queue
  WHERE payload->>'cliente_id' = p_cliente_id::text
    AND tipo = 'relatorio_semanal'
    AND status = 'concluido'
    AND concluido_em >= p_inicio AND concluido_em < p_fim + 1;

  -- Syncs CNES no período
  SELECT COUNT(*) INTO v_syncs_cnes
  FROM unidades_saude_sync_log
  WHERE cliente_id = p_cliente_id
    AND created_at >= p_inicio AND created_at < p_fim + 1;

  -- Notificações e-SUS enviadas no período
  SELECT COUNT(*) INTO v_notif_esus
  FROM item_notificacoes_esus
  WHERE cliente_id = p_cliente_id
    AND status = 'enviado'
    AND enviado_por IS NOT NULL
    AND created_at >= p_inicio AND created_at < p_fim + 1;

  -- Usuários com atividade no período (proxy: criados ou updated no período)
  SELECT COUNT(DISTINCT u.id) INTO v_usuarios_ativos
  FROM usuarios u
  WHERE u.cliente_id = p_cliente_id
    AND u.deleted_at IS NULL;

  -- Imóveis cadastrados (total acumulado ativo)
  SELECT COUNT(*) INTO v_imoveis_total
  FROM imoveis
  WHERE cliente_id = p_cliente_id AND ativo = true;

  RETURN jsonb_build_object(
    'cliente_id',           p_cliente_id,
    'periodo_inicio',       p_inicio,
    'periodo_fim',          p_fim,
    'vistorias_mes',        v_vistorias,
    'levantamentos_mes',    v_levantamentos,
    'itens_focos_mes',      v_itens_focos,
    'voos_mes',             v_voos,
    'denuncias_mes',        v_denuncias,
    'ia_calls_mes',         v_ia_calls,
    'relatorios_mes',       v_relatorios,
    'syncs_cnes_mes',       v_syncs_cnes,
    'notificacoes_esus_mes',v_notif_esus,
    'usuarios_ativos_mes',  v_usuarios_ativos,
    'imoveis_total',        v_imoveis_total,
    'calculado_em',         now()
  );
END;
$$;

REVOKE ALL ON FUNCTION calcular_uso_mensal(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calcular_uso_mensal(uuid, date, date) TO authenticated;

-- ─── 4. View uso ao vivo (para painel admin) ─────────────────────────────────

CREATE OR REPLACE VIEW v_billing_resumo AS
SELECT
  c.id                AS cliente_id,
  c.nome              AS cliente_nome,
  cp.plano_id,
  pl.nome             AS plano_nome,
  cp.status           AS plano_status,
  cp.contrato_ref,
  cp.data_inicio,
  cp.data_fim,
  -- Snapshot mais recente
  bus.periodo_inicio  AS ultimo_snapshot_inicio,
  bus.vistorias_mes,
  bus.levantamentos_mes,
  bus.itens_focos_mes,
  bus.ia_calls_mes,
  bus.storage_gb,
  bus.usuarios_ativos_mes,
  bus.calculado_em    AS snapshot_calculado_em,
  -- Limites do plano (com override de contrato)
  COALESCE((cp.limites_personalizados->>'limite_vistorias_mes')::int, pl.limite_vistorias_mes) AS limite_vistorias_mes,
  COALESCE((cp.limites_personalizados->>'limite_ia_calls_mes')::int,  pl.limite_ia_calls_mes)  AS limite_ia_calls_mes,
  COALESCE((cp.limites_personalizados->>'limite_storage_gb')::numeric, pl.limite_storage_gb)   AS limite_storage_gb,
  COALESCE((cp.limites_personalizados->>'limite_usuarios')::int,       pl.limite_usuarios)      AS limite_usuarios
FROM clientes c
LEFT JOIN cliente_plano cp ON cp.cliente_id = c.id
LEFT JOIN planos pl         ON pl.id = cp.plano_id
LEFT JOIN LATERAL (
  SELECT * FROM billing_usage_snapshot
  WHERE cliente_id = c.id
  ORDER BY periodo_inicio DESC
  LIMIT 1
) bus ON true
WHERE c.deleted_at IS NULL;

COMMENT ON VIEW v_billing_resumo IS
  'Resumo de billing por cliente: plano contratado + snapshot mais recente + limites efetivos.';
