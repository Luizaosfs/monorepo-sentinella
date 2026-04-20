-- ═══════════════════════════════════════════════════════════════════════════════
-- P0 — Identificador legível de focos (codigo_foco)
--
-- Formato: YYYY-NNNNNNNN  ex: 2026-00000001
-- Reinicia a contagem por (cliente_id, ano) — cada prefeitura tem sua série.
-- Gerado atomicamente via INSERT … ON CONFLICT DO UPDATE sem race condition.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela de sequência por (cliente, ano) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS foco_sequencia (
  cliente_id uuid    NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  ano        integer NOT NULL,
  ultimo     bigint  NOT NULL DEFAULT 0,
  PRIMARY KEY (cliente_id, ano)
);

-- Sem RLS — acesso apenas via SECURITY DEFINER
ALTER TABLE foco_sequencia ENABLE ROW LEVEL SECURITY;

-- ── 2. Função geradora de código (atômica) ────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_gerar_codigo_foco(
  p_cliente_id uuid,
  p_ano        integer
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq bigint;
BEGIN
  INSERT INTO foco_sequencia (cliente_id, ano, ultimo)
  VALUES (p_cliente_id, p_ano, 1)
  ON CONFLICT (cliente_id, ano) DO UPDATE
    SET ultimo = foco_sequencia.ultimo + 1
  RETURNING ultimo INTO v_seq;

  RETURN p_ano::text || '-' || lpad(v_seq::text, 8, '0');
END;
$$;

-- ── 3. Coluna codigo_foco em focos_risco ──────────────────────────────────────

ALTER TABLE focos_risco
  ADD COLUMN IF NOT EXISTS codigo_foco text;

-- ── 4. Trigger BEFORE INSERT: atribui codigo_foco automaticamente ─────────────

CREATE OR REPLACE FUNCTION fn_set_codigo_foco()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.codigo_foco IS NULL THEN
    NEW.codigo_foco := fn_gerar_codigo_foco(
      NEW.cliente_id,
      EXTRACT(YEAR FROM COALESCE(NEW.suspeita_em, now()))::integer
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_codigo_foco ON focos_risco;
CREATE TRIGGER trg_set_codigo_foco
  BEFORE INSERT ON focos_risco
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_codigo_foco();

-- ── 5. Índice único e NOT NULL após backfill ──────────────────────────────────

-- Backfill: atribui códigos aos focos existentes em ordem cronológica por cliente
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, cliente_id, EXTRACT(YEAR FROM created_at)::integer AS ano
    FROM focos_risco
    WHERE codigo_foco IS NULL
    ORDER BY cliente_id, created_at
  LOOP
    UPDATE focos_risco
    SET codigo_foco = fn_gerar_codigo_foco(r.cliente_id, r.ano)
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Índice único por (cliente_id, codigo_foco) — impede duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_focos_risco_codigo_foco
  ON focos_risco (cliente_id, codigo_foco);

COMMENT ON COLUMN focos_risco.codigo_foco IS
  'Identificador legível no formato YYYY-NNNNNNNN. '
  'Único por (cliente_id, codigo_foco). '
  'Gerado automaticamente pelo trigger trg_set_codigo_foco via fn_gerar_codigo_foco.';
