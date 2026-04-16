-- Migration Sprint 4: yolo_feedback + levantamento_analise_ia

-- ── yolo_feedback ──────────────────────────────────────────────────────────────
-- Registra feedback de operadores sobre detecções YOLO.
-- Usado para re-treino periódico do modelo.
CREATE TABLE IF NOT EXISTS yolo_feedback (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  levantamento_item_id  uuid        NOT NULL REFERENCES levantamento_itens(id) ON DELETE CASCADE,
  cliente_id            uuid        NOT NULL REFERENCES clientes(id)           ON DELETE CASCADE,
  confirmado            boolean     NOT NULL, -- true = confirmado em campo, false = falso positivo
  observacao            text,
  registrado_por        uuid        REFERENCES usuarios(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE yolo_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yolo_feedback_isolamento" ON yolo_feedback
  USING (
    cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid())
  );

CREATE INDEX ON yolo_feedback (levantamento_item_id);
CREATE INDEX ON yolo_feedback (cliente_id);

-- ── levantamento_analise_ia ────────────────────────────────────────────────────
-- Armazena o sumário executivo gerado pela triagem IA pós-voo (Edge Function).
CREATE TABLE IF NOT EXISTS levantamento_analise_ia (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  levantamento_id   uuid        NOT NULL REFERENCES levantamentos(id) ON DELETE CASCADE,
  cliente_id        uuid        NOT NULL REFERENCES clientes(id)      ON DELETE CASCADE,
  modelo            text        NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  total_focos       integer     NOT NULL DEFAULT 0,
  total_clusters    integer     NOT NULL DEFAULT 0,
  falsos_positivos  integer     NOT NULL DEFAULT 0,
  sumario           text        NOT NULL,
  clusters          jsonb,      -- array de clusters com focos agrupados
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE levantamento_analise_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analise_ia_isolamento" ON levantamento_analise_ia
  USING (
    cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid())
  );

CREATE INDEX ON levantamento_analise_ia (levantamento_id);
CREATE INDEX ON levantamento_analise_ia (cliente_id);
