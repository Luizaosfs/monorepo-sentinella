-- =============================================================================
-- PILOTO IA — INSTRUMENTAÇÃO DE EVENTOS
-- Registra uso das funcionalidades do piloto para medir adoção e impacto.
-- Fire-and-forget: sem FK obrigatória, sem bloquear o fluxo principal.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela principal de eventos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.piloto_eventos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid        NOT NULL,
  usuario_id uuid,                           -- auth.uid() no momento do evento
  tipo       text        NOT NULL,           -- ex: 'resumo_visualizado', 'rota_otimizada'
  payload    jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice principal para as views analíticas (por cliente + tipo + data)
CREATE INDEX IF NOT EXISTS idx_piloto_eventos_cliente_tipo_data
  ON public.piloto_eventos (cliente_id, tipo, created_at DESC);

-- Índice auxiliar para consultas por usuário
CREATE INDEX IF NOT EXISTS idx_piloto_eventos_usuario
  ON public.piloto_eventos (usuario_id, created_at DESC)
  WHERE usuario_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- RLS — isolamento por cliente (write: qualquer usuário autenticado do cliente)
-- -----------------------------------------------------------------------------
ALTER TABLE public.piloto_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "piloto_eventos_select" ON public.piloto_eventos
  FOR SELECT
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- INSERT permite qualquer usuário autenticado inserir eventos para seu cliente.
-- Não usamos usuario_pode_acessar_cliente() no INSERT para evitar overhead
-- em operações fire-and-forget de alta frequência; a validação de cliente_id
-- fica no lado da aplicação (logEvento sempre usa clienteId do hook central).
CREATE POLICY "piloto_eventos_insert" ON public.piloto_eventos
  FOR INSERT
  WITH CHECK (
    cliente_id IN (
      SELECT cliente_id FROM public.usuarios WHERE auth_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- VIEW — uso do resumo IA
-- Métricas de adoção do Resumo Executivo com IA
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_uso_resumo_ia AS
SELECT
  cliente_id,
  date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo') AS dia,
  COUNT(*) FILTER (WHERE tipo = 'resumo_visualizado')    AS visualizacoes,
  COUNT(*) FILTER (WHERE tipo = 'resumo_gerado')         AS geracoes_auto,
  COUNT(*) FILTER (WHERE tipo = 'resumo_refresh_manual') AS refreshes_manuais,
  COUNT(DISTINCT usuario_id)
    FILTER (WHERE tipo IN ('resumo_visualizado', 'resumo_gerado', 'resumo_refresh_manual'))
                                                          AS usuarios_unicos
FROM public.piloto_eventos
WHERE tipo IN ('resumo_visualizado', 'resumo_gerado', 'resumo_refresh_manual')
GROUP BY cliente_id, dia;

-- -----------------------------------------------------------------------------
-- VIEW — uso da rota inteligente do agente
-- Métricas de adoção do botão "Otimizar rota"
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_uso_rota AS
SELECT
  cliente_id,
  date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo') AS dia,
  COUNT(*) FILTER (WHERE tipo = 'rota_otimizada')  AS otimizacoes,
  COUNT(*) FILTER (WHERE tipo = 'rota_revertida')  AS reversoes,
  AVG((payload->>'imoveis_count')::int)
    FILTER (WHERE tipo = 'rota_otimizada')          AS media_imoveis_por_rota,
  COUNT(DISTINCT usuario_id)
    FILTER (WHERE tipo IN ('rota_otimizada', 'rota_revertida'))
                                                     AS agentes_unicos
FROM public.piloto_eventos
WHERE tipo IN ('rota_otimizada', 'rota_revertida')
GROUP BY cliente_id, dia;

-- -----------------------------------------------------------------------------
-- VIEW — operação de focos (comportamento gestor + agente)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_operacao_focos AS
SELECT
  cliente_id,
  date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo') AS dia,
  COUNT(*) FILTER (WHERE tipo = 'foco_visualizado')           AS focos_visualizados,
  COUNT(*) FILTER (WHERE tipo = 'foco_iniciado')              AS focos_iniciados,
  COUNT(*) FILTER (WHERE tipo = 'foco_resolvido')             AS focos_resolvidos,
  COUNT(*) FILTER (WHERE tipo = 'foco_alta_prioridade_listado') AS listagens_alta_prioridade,
  COUNT(*) FILTER (WHERE tipo = 'foco_critico_exibido')       AS criticos_exibidos,
  COUNT(*) FILTER (WHERE tipo = 'dashboard_aberto')           AS dashboards_abertos,
  COUNT(DISTINCT usuario_id)                                   AS usuarios_unicos,
  -- taxa de conversão: focos vistos que viraram ação
  CASE
    WHEN COUNT(*) FILTER (WHERE tipo = 'foco_visualizado') > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE tipo = 'foco_iniciado')::numeric /
      COUNT(*) FILTER (WHERE tipo = 'foco_visualizado')::numeric * 100, 1
    )
    ELSE NULL
  END AS taxa_conversao_pct
FROM public.piloto_eventos
WHERE tipo IN (
  'foco_visualizado', 'foco_iniciado', 'foco_resolvido',
  'foco_alta_prioridade_listado', 'foco_critico_exibido', 'dashboard_aberto'
)
GROUP BY cliente_id, dia;

-- Comentário da tabela para documentação no Supabase Studio
COMMENT ON TABLE public.piloto_eventos IS
  'Eventos de instrumentação do piloto de IA/operação. Fire-and-forget — sem impacto no fluxo principal.';
