-- =============================================================================
-- 3A: Canal cidadão cria focos_risco com origem_tipo='cidadao'
--
-- Problema: fn_criar_foco_de_levantamento_item() mapeia tipo_entrada='DRONE'→'drone'
-- e todo o resto → 'agente'. Itens criados por denunciar_cidadao() têm
-- payload->>'fonte' = 'cidadao' mas recebem origem_tipo='agente' — o módulo
-- GestorFocos filtra por origem_tipo e as denúncias não aparecem no canal cidadão.
-- Além disso, o filtro de prioridade bloqueia itens 'Média' (prioridade padrão
-- das denúncias), impedindo a criação do foco completamente.
--
-- Fix:
--   1. Detectar fonte='cidadao' no payload e usar origem_tipo='cidadao'.
--   2. Bypass do filtro de prioridade para itens de origem cidadão (qualquer risco gera foco).
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_criar_foco_de_levantamento_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id    uuid;
  v_imovel_id     uuid;
  v_origem_tipo   text;
  v_is_cidadao    bool;
  v_lev           record;
BEGIN
  SELECT l.cliente_id, l.tipo_entrada
    INTO v_lev
    FROM levantamentos l
   WHERE l.id = NEW.levantamento_id;

  IF v_lev.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_cliente_id := v_lev.cliente_id;

  -- FIX 3A: detectar fonte cidadão pelo payload
  v_is_cidadao := COALESCE(NEW.payload->>'fonte', '') = 'cidadao';

  -- Filtro de prioridade/risco: denúncias cidadão sempre passam
  IF NOT v_is_cidadao THEN
    IF NEW.prioridade NOT IN ('P1','P2','P3')
       AND lower(coalesce(NEW.risco,'')) NOT IN ('alto','crítico','critico')
    THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Tenta vincular ao imóvel mais próximo (raio 30m)
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    SELECT i.id INTO v_imovel_id
      FROM imoveis i
     WHERE i.cliente_id = v_cliente_id
       AND ST_DWithin(
             ST_MakePoint(NEW.longitude, NEW.latitude)::geography,
             ST_MakePoint(i.longitude,  i.latitude)::geography,
             30
           )
     ORDER BY ST_Distance(
               ST_MakePoint(NEW.longitude, NEW.latitude)::geography,
               ST_MakePoint(i.longitude,  i.latitude)::geography
              )
     LIMIT 1;
  END IF;

  -- FIX 3A: cidadão → 'cidadao'; drone → 'drone'; demais → 'agente'
  v_origem_tipo := CASE
    WHEN v_is_cidadao                               THEN 'cidadao'
    WHEN upper(COALESCE(v_lev.tipo_entrada,'')) = 'DRONE' THEN 'drone'
    ELSE 'agente'
  END;

  INSERT INTO focos_risco (
    cliente_id,
    imovel_id,
    origem_tipo,
    origem_levantamento_item_id,
    prioridade,
    latitude,
    longitude,
    endereco_normalizado,
    suspeita_em
  ) VALUES (
    v_cliente_id,
    v_imovel_id,
    v_origem_tipo,
    NEW.id,
    NEW.prioridade,
    NEW.latitude,
    NEW.longitude,
    NEW.endereco_curto,
    NEW.created_at
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_criar_foco_de_levantamento_item() IS
  'Trigger AFTER INSERT em levantamento_itens: cria foco_risco para itens de prioridade P1/P2/P3 ou risco alto/crítico. '
  'Fix 3A: detecta payload->>fonte=cidadao → origem_tipo=cidadao + bypass do filtro de prioridade. '
  'Mapeamento: DRONE→drone | cidadao→cidadao | demais→agente.';

-- Backfill: corrigir focos já criados com origem_tipo='agente' que deveriam ser 'cidadao'
UPDATE focos_risco fr
SET origem_tipo = 'cidadao'
FROM levantamento_itens li
WHERE fr.origem_levantamento_item_id = li.id
  AND fr.origem_tipo = 'agente'
  AND COALESCE(li.payload->>'fonte', '') = 'cidadao';
