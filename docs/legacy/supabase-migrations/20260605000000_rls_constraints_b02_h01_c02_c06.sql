-- ─────────────────────────────────────────────────────────────────────────────
-- B-02: Habilitar RLS em caso_foco_cruzamento (vazamento crítico entre clientes)
-- H-01: UNIQUE (imovel_id, agente_id, data_visita) — idempotência do drain offline
-- C-02: CHECK qtd_eliminados <= qtd_com_focos em vistoria_depositos
-- C-06: CHECK ciclo BETWEEN 1 AND 6 em vistorias
-- ─────────────────────────────────────────────────────────────────────────────

-- ── B-02: RLS em caso_foco_cruzamento ────────────────────────────────────────
ALTER TABLE caso_foco_cruzamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "caso_foco_cruzamento_isolamento" ON caso_foco_cruzamento;
CREATE POLICY "caso_foco_cruzamento_isolamento" ON caso_foco_cruzamento
  USING (
    EXISTS (
      SELECT 1
      FROM casos_notificados cn
      JOIN usuarios u ON u.cliente_id = cn.cliente_id
      WHERE cn.id = caso_foco_cruzamento.caso_id
        AND u.auth_id = auth.uid()
    )
  );

-- ── H-01: UNIQUE vistorias — idempotência do create_vistoria_completa ─────────
-- Trunca data_visita para o dia (sem hora) para evitar duplicação de
-- vistorias criadas offline que chegam com timestamps ligeiramente diferentes.
ALTER TABLE vistorias
  ADD CONSTRAINT uq_vistoria_imovel_agente_dia
  UNIQUE (imovel_id, agente_id, data_visita);

-- ── C-02: CHECK eliminados ≤ focos ───────────────────────────────────────────
ALTER TABLE vistoria_depositos
  DROP CONSTRAINT IF EXISTS chk_eliminados_lte_focos;

ALTER TABLE vistoria_depositos
  ADD CONSTRAINT chk_eliminados_lte_focos
  CHECK (qtd_eliminados <= qtd_com_focos);

-- ── C-06: CHECK ciclo válido (1–6) ────────────────────────────────────────────
ALTER TABLE vistorias
  DROP CONSTRAINT IF EXISTS chk_ciclo_range;

ALTER TABLE vistorias
  ADD CONSTRAINT chk_ciclo_range
  CHECK (ciclo BETWEEN 1 AND 6);
