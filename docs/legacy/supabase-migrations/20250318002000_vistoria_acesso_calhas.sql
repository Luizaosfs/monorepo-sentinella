-- ── Extensões na tabela vistorias ─────────────────────────────────────────────
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS acesso_realizado boolean NOT NULL DEFAULT true;
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS motivo_sem_acesso text
  CHECK (motivo_sem_acesso IN (
    'fechado_ausente', 'fechado_viagem', 'recusa_entrada',
    'cachorro_bravo', 'calha_inacessivel', 'outro'
  ));
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS proximo_horario_sugerido text
  CHECK (proximo_horario_sugerido IN ('manha', 'tarde', 'fim_de_semana', 'sem_previsao'));
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS observacao_acesso text;
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS foto_externa_url text;

-- ── Extensões na tabela imoveis ───────────────────────────────────────────────
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS proprietario_ausente boolean DEFAULT false;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS tipo_ausencia text
  CHECK (tipo_ausencia IN ('trabalho', 'temporada', 'abandonado', 'outro'));
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS contato_proprietario text;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS tem_animal_agressivo boolean DEFAULT false;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS historico_recusa boolean DEFAULT false;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS tem_calha boolean DEFAULT false;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS calha_acessivel boolean DEFAULT true;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS prioridade_drone boolean DEFAULT false;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS notificacao_formal_em date;

-- ── Nova tabela vistoria_calhas ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vistoria_calhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id uuid NOT NULL REFERENCES vistorias(id) ON DELETE CASCADE,
  posicao text NOT NULL
    CHECK (posicao IN ('frente', 'lateral_dir', 'lateral_esq', 'fundo', 'todas')),
  condicao text NOT NULL
    CHECK (condicao IN ('limpa', 'entupida', 'com_folhas', 'danificada', 'com_agua_parada')),
  com_foco boolean NOT NULL DEFAULT false,
  acessivel boolean NOT NULL DEFAULT true,
  tratamento_realizado boolean NOT NULL DEFAULT false,
  foto_url text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vistoria_calhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isolamento_vistoria_calhas" ON vistoria_calhas
  USING (vistoria_id IN (
    SELECT id FROM vistorias WHERE cliente_id IN (
      SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
    )
  ));

CREATE INDEX IF NOT EXISTS vistoria_calhas_vistoria_id_idx ON vistoria_calhas (vistoria_id);

-- ── Trigger: 3+ tentativas sem acesso → prioridade drone ─────────────────────
CREATE OR REPLACE FUNCTION fn_atualizar_perfil_imovel()
RETURNS TRIGGER AS $$
DECLARE
  v_sem_acesso int;
BEGIN
  IF NEW.acesso_realizado = false THEN
    SELECT COUNT(*) INTO v_sem_acesso
    FROM vistorias
    WHERE imovel_id = NEW.imovel_id
      AND acesso_realizado = false;

    IF v_sem_acesso >= 3 THEN
      UPDATE imoveis
      SET historico_recusa = true,
          prioridade_drone  = true
      WHERE id = NEW.imovel_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_atualizar_perfil_imovel ON vistorias;
CREATE TRIGGER trg_atualizar_perfil_imovel
  AFTER INSERT OR UPDATE ON vistorias
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_perfil_imovel();

-- ── View v_imovel_historico_acesso ────────────────────────────────────────────
CREATE OR REPLACE VIEW v_imovel_historico_acesso AS
SELECT
  i.id                  AS imovel_id,
  i.cliente_id,
  i.logradouro,
  i.numero,
  i.bairro,
  i.quarteirao,
  i.proprietario_ausente,
  i.tipo_ausencia,
  i.tem_animal_agressivo,
  i.historico_recusa,
  i.prioridade_drone,
  i.tem_calha,
  i.calha_acessivel,
  i.notificacao_formal_em,
  COUNT(v.id)           AS total_visitas,
  COUNT(v.id) FILTER (WHERE v.acesso_realizado = false) AS total_sem_acesso,
  ROUND(
    COUNT(v.id) FILTER (WHERE v.acesso_realizado = false)::numeric
    / NULLIF(COUNT(v.id), 0) * 100, 1
  )                     AS pct_sem_acesso,
  MAX(v.data_visita) FILTER (WHERE v.acesso_realizado = true) AS ultima_visita_com_acesso,
  MAX(v.data_visita)    AS ultima_tentativa,
  (
    COUNT(v.id) FILTER (WHERE v.acesso_realizado = false)::numeric
    / NULLIF(COUNT(v.id), 0) > 0.8
    OR i.proprietario_ausente = true
  )                     AS requer_notificacao_formal
FROM imoveis i
LEFT JOIN vistorias v ON v.imovel_id = i.id
GROUP BY i.id;
