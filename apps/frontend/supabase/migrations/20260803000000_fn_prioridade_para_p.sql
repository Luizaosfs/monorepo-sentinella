-- =============================================================================
-- 4A: Função canônica de conversão de prioridade legada → P1-P5
--
-- Problema: dois sistemas de prioridade coexistem:
--   - Legado (levantamento_itens): 'Crítico'/'Crítica', 'Urgente', 'Alta', 'Média', 'Baixa'
--   - Novo (focos_risco): 'P1', 'P2', 'P3', 'P4', 'P5'
-- Triggers e funções duplicam a lógica de conversão em vários lugares,
-- criando risco de divergência. Centralizar em fn_prioridade_para_p().
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_prioridade_para_p(p_prioridade text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE upper(trim(COALESCE(p_prioridade, '')))
    WHEN 'P1'      THEN 'P1'
    WHEN 'P2'      THEN 'P2'
    WHEN 'P3'      THEN 'P3'
    WHEN 'P4'      THEN 'P4'
    WHEN 'P5'      THEN 'P5'
    -- Legado em português
    WHEN 'CRÍTICO'  THEN 'P1'
    WHEN 'CRITICO'  THEN 'P1'
    WHEN 'CRÍTICA'  THEN 'P1'
    WHEN 'CRITICA'  THEN 'P1'
    WHEN 'URGENTE'  THEN 'P2'
    WHEN 'ALTA'     THEN 'P3'
    WHEN 'MÉDIA'    THEN 'P4'
    WHEN 'MEDIA'    THEN 'P4'
    WHEN 'BAIXA'    THEN 'P5'
    -- Monitoramento / outros mapeiam para P5
    WHEN 'MONITORAMENTO' THEN 'P5'
    ELSE 'P3'  -- fallback conservador: prioridade média
  END;
$$;

COMMENT ON FUNCTION public.fn_prioridade_para_p(text) IS
  'Converte prioridade legada (Crítico, Alta, Média...) para notação P1-P5 do aggregate root focos_risco. '
  'IMMUTABLE e PARALLEL SAFE — seguro para uso em índices funcionais e consultas paralelas. '
  'Fallback: P3 (Alta) para valores não reconhecidos.';

-- ── Função inversa: P1-P5 → rótulo legado (útil para exibição ao operador) ───

CREATE OR REPLACE FUNCTION public.fn_p_para_prioridade(p_p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE upper(trim(COALESCE(p_p, '')))
    WHEN 'P1' THEN 'Crítico'
    WHEN 'P2' THEN 'Urgente'
    WHEN 'P3' THEN 'Alta'
    WHEN 'P4' THEN 'Média'
    WHEN 'P5' THEN 'Baixa'
    ELSE 'Média'
  END;
$$;

COMMENT ON FUNCTION public.fn_p_para_prioridade(text) IS
  'Converte notação P1-P5 (focos_risco) para rótulo legado em português. '
  'Útil para exibição em relatórios e compatibilidade com levantamento_itens.';

GRANT EXECUTE ON FUNCTION public.fn_prioridade_para_p(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_p_para_prioridade(text)  TO authenticated;

-- ── Atualizar fn_criar_foco_de_levantamento_item para usar a função canônica ──
-- (já corrigida em 3A, mas garantir que a prioridade seja normalizada)

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
  v_prioridade_p  text;
  v_lev           record;
BEGIN
  SELECT l.cliente_id, l.tipo_entrada
    INTO v_lev
    FROM levantamentos l
   WHERE l.id = NEW.levantamento_id;

  IF v_lev.cliente_id IS NULL THEN RETURN NEW; END IF;

  v_cliente_id := v_lev.cliente_id;
  v_is_cidadao := COALESCE(NEW.payload->>'fonte', '') = 'cidadao';

  -- Filtro de prioridade/risco: cidadão sempre passa
  IF NOT v_is_cidadao THEN
    IF NEW.prioridade NOT IN ('P1','P2','P3')
       AND lower(COALESCE(NEW.risco,'')) NOT IN ('alto','crítico','critico')
    THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Vincular ao imóvel mais próximo (raio 30m)
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

  v_origem_tipo := CASE
    WHEN v_is_cidadao                                    THEN 'cidadao'
    WHEN upper(COALESCE(v_lev.tipo_entrada,'')) = 'DRONE' THEN 'drone'
    ELSE 'agente'
  END;

  -- 4A: normalizar prioridade para P1-P5 usando função canônica
  v_prioridade_p := public.fn_prioridade_para_p(NEW.prioridade);

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
    v_prioridade_p,
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
  'Trigger AFTER INSERT em levantamento_itens: cria foco_risco. '
  'Fix 3A: origem_tipo=cidadao para payload->fonte=cidadao. '
  'Fix 4A: prioridade normalizada para P1-P5 via fn_prioridade_para_p().';
