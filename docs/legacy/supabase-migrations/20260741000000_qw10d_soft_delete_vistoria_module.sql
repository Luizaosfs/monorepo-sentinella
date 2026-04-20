-- QW-10D: Soft delete no módulo de Vistoria de Campo
-- Estende a proteção de dados iniciada no QW-10A para as tabelas do módulo de vistoria.
-- Tabelas cobertas: imoveis, vistorias, vistoria_depositos, vistoria_sintomas,
--                   vistoria_riscos, vistoria_calhas
--
-- Padrão: deleted_at TIMESTAMPTZ + deleted_by UUID (igual QW-10A)
-- Trigger: bloqueia DELETE direto nas tabelas principais (imoveis, vistorias)

-- ── imoveis ───────────────────────────────────────────────────────────────────

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_imoveis_deleted_at
  ON imoveis (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── vistorias ─────────────────────────────────────────────────────────────────

ALTER TABLE vistorias
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vistorias_deleted_at
  ON vistorias (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── vistoria_depositos ────────────────────────────────────────────────────────

ALTER TABLE vistoria_depositos
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_vistoria_depositos_deleted_at
  ON vistoria_depositos (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── vistoria_sintomas ─────────────────────────────────────────────────────────

ALTER TABLE vistoria_sintomas
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_vistoria_sintomas_deleted_at
  ON vistoria_sintomas (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── vistoria_riscos ───────────────────────────────────────────────────────────

ALTER TABLE vistoria_riscos
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_vistoria_riscos_deleted_at
  ON vistoria_riscos (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── vistoria_calhas ───────────────────────────────────────────────────────────

ALTER TABLE vistoria_calhas
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_vistoria_calhas_deleted_at
  ON vistoria_calhas (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── Trigger: bloquear DELETE em imoveis ───────────────────────────────────────
-- Força uso de UPDATE SET deleted_at = now() em vez de DELETE.
-- Exceção: registros sem dados vinculados (nunca tiveram vistorias) podem ser apagados.

CREATE OR REPLACE FUNCTION fn_bloquear_delete_imovel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM vistorias WHERE imovel_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION
      'Imóvel com vistorias não pode ser apagado. Use deleted_at = now() para inativação.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_delete_imovel ON imoveis;
CREATE TRIGGER trg_bloquear_delete_imovel
  BEFORE DELETE ON imoveis
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete_imovel();

-- ── Trigger: bloquear DELETE em vistorias ─────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_bloquear_delete_vistoria()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Vistorias não podem ser apagadas. Use deleted_at = now() para inativação.'
    USING ERRCODE = 'P0001';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_delete_vistoria ON vistorias;
CREATE TRIGGER trg_bloquear_delete_vistoria
  BEFORE DELETE ON vistorias
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete_vistoria();

-- ── View: v_itens_deletados_vistoria (auditoria) ──────────────────────────────

CREATE OR REPLACE VIEW v_vistorias_deletadas AS
SELECT
  v.id,
  v.cliente_id,
  v.imovel_id,
  v.agente_id,
  v.data_visita,
  v.status,
  v.deleted_at,
  v.deleted_by,
  u.nome AS deletado_por_nome
FROM vistorias v
LEFT JOIN usuarios u ON u.auth_id = v.deleted_by
WHERE v.deleted_at IS NOT NULL
ORDER BY v.deleted_at DESC;

-- RLS: apenas admin visualiza registros deletados
ALTER VIEW v_vistorias_deletadas OWNER TO postgres;
