-- Tabela para rastrear execuções do pipeline Python de processamento de voos de drone.
-- O pipeline Python deve inserir ao iniciar e atualizar ao concluir/falhar via service_role.

CREATE TABLE IF NOT EXISTS public.pipeline_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  voo_id              uuid        REFERENCES voos(id) ON DELETE SET NULL,
  levantamento_id     uuid        REFERENCES levantamentos(id) ON DELETE SET NULL,
  status              text        NOT NULL DEFAULT 'em_andamento'
                        CHECK (status IN ('em_andamento', 'concluido', 'erro', 'parcial')),
  total_imagens       integer,
  imagens_processadas integer,
  itens_gerados       integer,
  focos_criados       integer,
  erro_mensagem       text,
  erro_detalhe        jsonb,
  versao_pipeline     text,
  iniciado_em         timestamptz  NOT NULL DEFAULT now(),
  concluido_em        timestamptz,
  duracao_s           integer GENERATED ALWAYS AS (
    CASE WHEN concluido_em IS NOT NULL
    THEN EXTRACT(EPOCH FROM (concluido_em - iniciado_em))::integer
    END
  ) STORED,
  created_at          timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_runs_select" ON public.pipeline_runs
  FOR SELECT TO authenticated
  USING (cliente_id IN (
    SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_cliente ON public.pipeline_runs (cliente_id, iniciado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status  ON public.pipeline_runs (status) WHERE status = 'erro';
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_levant  ON public.pipeline_runs (levantamento_id) WHERE levantamento_id IS NOT NULL;

COMMENT ON TABLE public.pipeline_runs IS
  'Rastreia execuções do pipeline Python de processamento de voos de drone. '
  'O pipeline insere via service_role ao iniciar e atualiza ao concluir/falhar.';

-- View Imóvel 360° — fase 1: resumo territorial unificado
CREATE OR REPLACE VIEW v_imovel_resumo
WITH (security_invoker = true)
AS
SELECT
  im.id,
  im.cliente_id,
  im.bairro,
  im.quarteirao,
  im.logradouro,
  im.numero,
  im.tipo_imovel,
  im.latitude,
  im.longitude,
  im.historico_recusa,
  im.prioridade_drone,
  im.tem_calha,
  im.calha_acessivel,
  COUNT(DISTINCT v.id)                                                               AS total_vistorias,
  MAX(v.data_visita)                                                                 AS ultima_visita,
  COUNT(DISTINCT CASE WHEN v.acesso_realizado = false THEN v.id END)                AS tentativas_sem_acesso,
  COUNT(DISTINCT fr.id)                                                              AS total_focos_historico,
  COUNT(DISTINCT CASE WHEN fr.status NOT IN ('resolvido','descartado') THEN fr.id END) AS focos_ativos,
  MAX(fr.created_at)                                                                 AS ultimo_foco_em,
  COUNT(DISTINCT CASE WHEN sla.status IN ('pendente','em_atendimento') THEN sla.id END) AS slas_abertos,
  COUNT(DISTINCT CASE WHEN fr.foco_anterior_id IS NOT NULL THEN fr.id END)          AS focos_recorrentes
FROM imoveis im
LEFT JOIN vistorias v      ON v.imovel_id = im.id AND v.deleted_at IS NULL
LEFT JOIN focos_risco fr   ON fr.imovel_id = im.id AND fr.deleted_at IS NULL
LEFT JOIN sla_operacional sla ON sla.foco_risco_id = fr.id
WHERE im.deleted_at IS NULL
GROUP BY im.id;

GRANT SELECT ON v_imovel_resumo TO authenticated;

COMMENT ON VIEW v_imovel_resumo IS
  'Resumo territorial do imóvel: vistorias, focos históricos, SLA ativo, recorrência. '
  'Base do módulo Imóvel 360°. security_invoker=true herda RLS do usuário.';
