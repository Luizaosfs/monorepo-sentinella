-- =============================================================================
-- Migration: 20270219000000_consolidacao_vistoria_fase1.sql
-- Fase 1 — Estrutura de dados para consolidação automática de vistoria
--
-- Especificação: V2 (aprovada)
-- Implementa APENAS infraestrutura de dados. Sem função nem trigger.
-- Fase 2 adicionará fn_consolidar_vistoria().
-- Fase 3 adicionará trigger pós-insert e suporte a reprocessamento.
--
-- Ajustes finais aplicados (pós-aprovação):
--   • Fallback P3 quando há dado/histórico relevante; P4 apenas vazio completo
--   • sem_acesso recorrente: >=3 tentativas → P3 | >=5 tentativas → P2
-- =============================================================================

-- ── 1. Novas colunas em vistorias ────────────────────────────────────────────

ALTER TABLE vistorias
  -- Dimensões de consolidação
  ADD COLUMN IF NOT EXISTS resultado_operacional      text
    CHECK (resultado_operacional IN
      ('visitado','sem_acesso','sem_acesso_retorno')),

  ADD COLUMN IF NOT EXISTS vulnerabilidade_domiciliar text
    CHECK (vulnerabilidade_domiciliar IN
      ('baixa','media','alta','critica','inconclusivo')),

  ADD COLUMN IF NOT EXISTS alerta_saude               text
    CHECK (alerta_saude IN
      ('nenhum','atencao','urgente','inconclusivo')),

  ADD COLUMN IF NOT EXISTS risco_socioambiental       text
    CHECK (risco_socioambiental IN
      ('baixo','medio','alto','inconclusivo')),

  ADD COLUMN IF NOT EXISTS risco_vetorial             text
    CHECK (risco_vetorial IN
      ('baixo','medio','alto','critico','inconclusivo')),

  -- Prioridade final: nunca nula após consolidação (P1–P5 via fallback obrigatório)
  ADD COLUMN IF NOT EXISTS prioridade_final           text
    CHECK (prioridade_final IN ('P1','P2','P3','P4','P5')),

  -- Explicabilidade
  ADD COLUMN IF NOT EXISTS prioridade_motivo          text,
  ADD COLUMN IF NOT EXISTS dimensao_dominante         text,
  ADD COLUMN IF NOT EXISTS consolidacao_resumo        text,
  ADD COLUMN IF NOT EXISTS consolidacao_json          jsonb,

  -- Confiabilidade: true quando alguma dimensão ficou inconclusiva
  ADD COLUMN IF NOT EXISTS consolidacao_incompleta    boolean NOT NULL DEFAULT false,

  -- Versionamento: rastreia qual algoritmo e quais pesos geraram esta consolidação
  ADD COLUMN IF NOT EXISTS versao_regra_consolidacao  text,
  ADD COLUMN IF NOT EXISTS versao_pesos_consolidacao  text,
  ADD COLUMN IF NOT EXISTS consolidado_em             timestamptz,

  -- Reprocessamento: preenchidos apenas quando a consolidação foi regenerada
  ADD COLUMN IF NOT EXISTS reprocessado_em            timestamptz,
  ADD COLUMN IF NOT EXISTS reprocessado_por           uuid REFERENCES usuarios(id);

COMMENT ON COLUMN vistorias.prioridade_final IS
  'P1–P5. Nunca nula após consolidação. '
  'Fallback P3 quando há dado/histórico; P4 quando completamente vazio. '
  'Gerada por fn_consolidar_vistoria() (Fase 2).';

COMMENT ON COLUMN vistorias.consolidacao_incompleta IS
  'true quando uma ou mais dimensões ficaram inconclusivas. '
  'Indica baixa confiança na prioridade_final gerada por fallback.';

COMMENT ON COLUMN vistorias.consolidacao_json IS
  'Snapshot completo da consolidação: dimensões, regras acionadas, versões. '
  'Estrutura documentada na especificação V2, seção 7.2.';

-- Índices para filtros frequentes no painel do gestor e GestorTriagem
CREATE INDEX IF NOT EXISTS idx_vistorias_prioridade_final
  ON vistorias (cliente_id, prioridade_final)
  WHERE prioridade_final IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vistorias_risco_vetorial
  ON vistorias (cliente_id, risco_vetorial)
  WHERE risco_vetorial IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vistorias_alerta_saude
  ON vistorias (cliente_id, alerta_saude)
  WHERE alerta_saude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vistorias_consolidacao_incompleta
  ON vistorias (cliente_id, consolidacao_incompleta)
  WHERE consolidacao_incompleta = true;


-- ── 2. Tabela consolidacao_pesos_config ──────────────────────────────────────
--
-- Armazena pesos do risco socioambiental e limiares de classificação.
-- cliente_id NULL  = configuração global default (fallback para todos os clientes).
-- cliente_id UUID  = override específico do cliente.
-- A fn_consolidar_vistoria() carrega: primeiro tenta cliente; depois global.

CREATE TABLE IF NOT EXISTS consolidacao_pesos_config (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid        REFERENCES clientes(id) ON DELETE CASCADE,
  flag_nome   text        NOT NULL,
  grupo       text        NOT NULL
    CHECK (grupo IN ('social','sanitario','vetorial_ambiental','limiar')),
  peso        numeric(5,2) NOT NULL CHECK (peso >= 0),
  versao      text        NOT NULL,
  ativo       boolean     NOT NULL DEFAULT true,
  observacao  text,
  criado_por  uuid        REFERENCES usuarios(id),
  criado_em   timestamptz NOT NULL DEFAULT now(),

  -- Unicidade: um cliente/global não pode ter dois registros ativos
  -- para a mesma flag na mesma versão.
  -- NULLS NOT DISTINCT trata NULL como valor igual (PostgreSQL 15+).
  UNIQUE NULLS NOT DISTINCT (cliente_id, flag_nome, versao)
);

COMMENT ON TABLE consolidacao_pesos_config IS
  'Pesos configuráveis do risco socioambiental e limiares de classificação da vistoria. '
  'cliente_id NULL = default global. Override por cliente sem necessidade de deploy. '
  'Consumida por fn_consolidar_vistoria() (Fase 2).';

CREATE INDEX IF NOT EXISTS idx_consolidacao_pesos_lookup
  ON consolidacao_pesos_config (cliente_id, versao, ativo);

CREATE INDEX IF NOT EXISTS idx_consolidacao_pesos_global
  ON consolidacao_pesos_config (versao, ativo)
  WHERE cliente_id IS NULL;

ALTER TABLE consolidacao_pesos_config ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário autenticado vê configs globais + configs do próprio cliente
CREATE POLICY "consolidacao_pesos_leitura" ON consolidacao_pesos_config
  FOR SELECT TO authenticated
  USING (
    cliente_id IS NULL
    OR public.usuario_pode_acessar_cliente(cliente_id)
  );

-- Escrita: somente admin da plataforma
CREATE POLICY "consolidacao_pesos_admin_insert" ON consolidacao_pesos_config
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "consolidacao_pesos_admin_update" ON consolidacao_pesos_config
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "consolidacao_pesos_admin_delete" ON consolidacao_pesos_config
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ── 3. Seed — pesos default globais v1.0.0 ───────────────────────────────────
--
-- Valores baseados na especificação V2, seção 4.4.
-- Todos marcados como hipóteses operacionais pendentes de validação do cliente.
-- Podem ser ajustados via INSERT de nova versão sem redeployar.

INSERT INTO consolidacao_pesos_config
  (cliente_id, flag_nome, grupo, peso, versao, ativo, observacao)
VALUES
  -- ── Social (peso 1.0) ───────────────────────────────────────────────────
  (NULL, 'menor_incapaz',             'social',             1.00, '1.0.0', true,
   'Menor sem responsável apto — peso hipotético, validar com cliente'),
  (NULL, 'idoso_incapaz',             'social',             1.00, '1.0.0', true,
   'Idoso sem autonomia — peso hipotético, validar com cliente'),
  (NULL, 'dep_quimico',               'social',             1.00, '1.0.0', true,
   'Dependente químico no domicílio'),
  (NULL, 'risco_alimentar',           'social',             1.00, '1.0.0', true,
   'Insegurança alimentar'),
  (NULL, 'risco_moradia',             'social',             1.00, '1.0.0', true,
   'Condições inadequadas de moradia'),

  -- ── Sanitário (peso 1.5) ─────────────────────────────────────────────────
  (NULL, 'criadouro_animais',         'sanitario',          1.50, '1.0.0', true,
   'Animais em condições de risco'),
  (NULL, 'lixo',                      'sanitario',          1.50, '1.0.0', true,
   'Acúmulo de lixo'),
  (NULL, 'residuos_organicos',        'sanitario',          1.50, '1.0.0', true,
   'Resíduos orgânicos expostos'),
  (NULL, 'residuos_quimicos',         'sanitario',          1.50, '1.0.0', true,
   'Resíduos químicos'),
  (NULL, 'residuos_medicos',          'sanitario',          1.50, '1.0.0', true,
   'Resíduos médicos (seringas, curativos) — validar se é flag dominante isolada'),

  -- ── Vetorial ambiental (peso 2.0) ────────────────────────────────────────
  (NULL, 'acumulo_material_organico', 'vetorial_ambiental', 2.00, '1.0.0', true,
   'Material propício a criadouros do Aedes aegypti'),
  (NULL, 'animais_sinais_lv',         'vetorial_ambiental', 2.00, '1.0.0', true,
   'Sinais de leishmaniose visceral — validar escopo (LV vs dengue)'),
  (NULL, 'caixa_destampada',          'vetorial_ambiental', 2.00, '1.0.0', true,
   'Caixa d''água sem tampa — criadouro primário'),
  (NULL, 'outro_risco_vetorial',      'vetorial_ambiental', 2.00, '1.0.0', true,
   'Risco vetorial não categorizado'),

  -- ── Limiares de classificação (grupo limiar, peso = valor do limiar) ─────
  (NULL, 'limiar_baixo_medio',        'limiar',             2.00, '1.0.0', true,
   'Pontuação mínima para nível médio — hipótese operacional'),
  (NULL, 'limiar_medio_alto',         'limiar',             5.00, '1.0.0', true,
   'Pontuação mínima para nível alto — hipótese operacional')

ON CONFLICT (cliente_id, flag_nome, versao) DO NOTHING;


-- ── 4. Tabela vistoria_consolidacao_historico ─────────────────────────────────
--
-- Arquivo append-only de consolidações anteriores.
-- Antes de cada reprocessamento, a consolidação corrente é copiada aqui.
-- Nunca sofre UPDATE ou DELETE — apenas INSERT via fn_consolidar_vistoria().

CREATE TABLE IF NOT EXISTS vistoria_consolidacao_historico (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id            uuid        NOT NULL REFERENCES vistorias(id) ON DELETE CASCADE,
  prioridade_final       text        CHECK (prioridade_final IN ('P1','P2','P3','P4','P5')),
  dimensao_dominante     text,
  consolidacao_json      jsonb,
  versao_regra           text,
  versao_pesos           text,
  consolidado_em         timestamptz,
  arquivado_em           timestamptz NOT NULL DEFAULT now(),
  motivo_reprocessamento text        NOT NULL,
  reprocessado_por       uuid        REFERENCES usuarios(id)
);

COMMENT ON TABLE vistoria_consolidacao_historico IS
  'Arquivo imutável de consolidações anteriores. '
  'INSERT-only via fn_consolidar_vistoria() (Fase 2). '
  'Nenhuma policy de escrita direta para usuários.';

-- Índice principal: histórico de uma vistoria em ordem cronológica reversa
CREATE INDEX IF NOT EXISTS idx_consolidacao_historico_vistoria
  ON vistoria_consolidacao_historico (vistoria_id, arquivado_em DESC);

ALTER TABLE vistoria_consolidacao_historico ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário pode ver histórico de vistorias que já pode acessar
CREATE POLICY "consolidacao_historico_leitura" ON vistoria_consolidacao_historico
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vistorias v
      WHERE v.id = vistoria_consolidacao_historico.vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

-- Escrita: sem policy para usuários diretos.
-- Apenas funções SECURITY DEFINER (fn_consolidar_vistoria, Fase 2) podem inserir.
-- Nenhum UPDATE ou DELETE permitido — tabela é append-only por design.
