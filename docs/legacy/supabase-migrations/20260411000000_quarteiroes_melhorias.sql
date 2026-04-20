-- ============================================================
-- Melhorias no módulo de Distribuição de Quarteirões
-- ============================================================

-- 1. Normalização automática de quarteirao em imoveis (TRIM)
CREATE OR REPLACE FUNCTION fn_normalize_quarteirao()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quarteirao IS NOT NULL THEN
    NEW.quarteirao = TRIM(NEW.quarteirao);
    IF NEW.quarteirao = '' THEN
      NEW.quarteirao = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_quarteirao ON imoveis;
CREATE TRIGGER trg_normalize_quarteirao
  BEFORE INSERT OR UPDATE OF quarteirao ON imoveis
  FOR EACH ROW EXECUTE FUNCTION fn_normalize_quarteirao();

-- Aplica normalização nos dados existentes
UPDATE imoveis SET quarteirao = TRIM(quarteirao) WHERE quarteirao IS NOT NULL;
UPDATE imoveis SET quarteirao = NULL WHERE quarteirao = '';

-- 2. Tabela mestre de quarteirões (fonte canônica)
CREATE TABLE IF NOT EXISTS quarteiroes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  regiao_id  uuid        REFERENCES regioes(id) ON DELETE SET NULL,
  codigo     text        NOT NULL,
  bairro     text,
  ativo      boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, codigo)
);

ALTER TABLE quarteiroes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quarteiroes_isolamento" ON quarteiroes;
CREATE POLICY "quarteiroes_isolamento" ON quarteiroes
  FOR ALL TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE INDEX IF NOT EXISTS idx_quarteiroes_cliente ON quarteiroes (cliente_id);

-- 3. Popula quarteiroes a partir de imoveis já cadastrados
INSERT INTO quarteiroes (cliente_id, codigo, bairro)
SELECT DISTINCT
  i.cliente_id,
  TRIM(i.quarteirao) AS codigo,
  i.bairro
FROM imoveis i
WHERE i.quarteirao IS NOT NULL AND TRIM(i.quarteirao) <> ''
ON CONFLICT (cliente_id, codigo) DO NOTHING;

-- 4. Trigger: ao cadastrar/atualizar imóvel com quarteirao,
--    garante que ele exista na tabela mestre
CREATE OR REPLACE FUNCTION fn_sync_quarteirao_mestre()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.quarteirao IS NOT NULL AND NEW.quarteirao <> '' THEN
    INSERT INTO quarteiroes (cliente_id, codigo, bairro)
    VALUES (NEW.cliente_id, NEW.quarteirao, NEW.bairro)
    ON CONFLICT (cliente_id, codigo) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_quarteirao_mestre ON imoveis;
CREATE TRIGGER trg_sync_quarteirao_mestre
  AFTER INSERT OR UPDATE OF quarteirao ON imoveis
  FOR EACH ROW EXECUTE FUNCTION fn_sync_quarteirao_mestre();

-- 5. RPC: copiar distribuição de um ciclo para outro
--    Retorna quantos quarteirões foram copiados (ignora conflitos)
CREATE OR REPLACE FUNCTION copiar_distribuicao_ciclo(
  p_cliente_id    uuid,
  p_ciclo_origem  integer,
  p_ciclo_destino integer
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO distribuicao_quarteirao (cliente_id, ciclo, quarteirao, agente_id, regiao_id)
  SELECT
    d.cliente_id,
    p_ciclo_destino,
    d.quarteirao,
    d.agente_id,
    d.regiao_id
  FROM distribuicao_quarteirao d
  WHERE d.cliente_id = p_cliente_id
    AND d.ciclo = p_ciclo_origem
  ON CONFLICT (cliente_id, ciclo, quarteirao) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 6. RPC: cobertura de quarteirões por ciclo
--    Retorna estatísticas de visitação por quarteirão
CREATE OR REPLACE FUNCTION cobertura_quarteirao_ciclo(
  p_cliente_id uuid,
  p_ciclo      integer
) RETURNS TABLE (
  quarteirao      text,
  bairro          text,
  agente_id       uuid,
  total_imoveis   bigint,
  visitados       bigint,
  pct_cobertura   numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    d.quarteirao,
    MAX(i.bairro)                                                             AS bairro,
    d.agente_id,
    COUNT(DISTINCT i.id)                                                      AS total_imoveis,
    COUNT(DISTINCT v.imovel_id)
      FILTER (WHERE v.status IN ('visitado', 'fechado'))                      AS visitados,
    CASE
      WHEN COUNT(DISTINCT i.id) = 0 THEN 0
      ELSE ROUND(
        100.0 * COUNT(DISTINCT v.imovel_id) FILTER (WHERE v.status IN ('visitado', 'fechado'))
        / COUNT(DISTINCT i.id), 1
      )
    END                                                                       AS pct_cobertura
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
