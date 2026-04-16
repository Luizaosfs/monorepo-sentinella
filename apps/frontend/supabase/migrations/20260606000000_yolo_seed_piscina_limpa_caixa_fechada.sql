-- =============================================================================
-- YOLO / catálogo: piscina_limpa, caixa_dagua_fechada; atualiza piscina_suja;
-- backfill sentinela_yolo_class_config, sentinela_yolo_synonym e plano_acao.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. RPC: mesma lógica anterior + 2 tipos; texto de piscina_suja alinhado ao seed TS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_plano_acao_catalogo_por_tipo(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Pneu
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Coletar e descartar adequadamente', 'Recolher pneu e encaminhar para descarte correto (borracharia, coleta seletiva ou ponto de entrega voluntária).', 'pneu', 11
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'pneu'
  );

  -- Recipiente com água
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Eliminar água acumulada', 'Esvaziar, virar ou remover o recipiente para evitar acúmulo de água parada.', 'recipiente', 12
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'recipiente'
  );

  -- Piscina suja
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Tratamento e limpeza da piscina suja', 'Vistoria imediata; tratamento da água, limpeza e orientação ao responsável.', 'piscina_suja', 13
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'piscina_suja'
  );

  -- Caixa d'água aberta
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Tampar ou aplicar larvicida', 'Instalar tampa adequada na caixa d''água ou aplicar larvicida homologado; orientar responsável.', 'caixa_dagua', 14
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'caixa_dagua'
  );

  -- Lixo / entulho
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Remover entulho e materiais acumulados', 'Acionar coleta de entulho ou mutirão de limpeza; orientar descarte correto ao morador.', 'lixo', 15
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'lixo'
  );

  -- Poça de água
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Drenagem local', 'Realizar drenagem da poça; verificar causa (pavimentação, sarjeta entupida) e acionar equipe de obras se necessário.', 'poca', 16
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'poca'
  );

  -- Calha entupida
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Limpar calha e verificar escoamento', 'Desobstruir calha e garantir escoamento adequado; orientar morador sobre limpeza periódica.', 'calha', 17
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'calha'
  );

  -- Vaso de planta
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Verificar acúmulo de água no prato', 'Orientar morador a esvaziar pratos de vasos regularmente; sugerir areia no prato como alternativa.', 'vaso_planta', 18
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'vaso_planta'
  );

  -- Tampa ou recipiente aberto
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Tampar ou eliminar recipiente', 'Tampar hermeticamente ou descartar o recipiente; verificar se há larvas antes de esvaziar.', 'tampa', 19
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'tampa'
  );

  -- Barril ou tonel
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Tampar hermeticamente ou esvaziar', 'Instalar tampa vedante no barril/tonel ou esvaziar e virar; aplicar larvicida se não for possível esvaziar.', 'barril', 20
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'barril'
  );

  -- Piscina limpa (YOLO)
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Manter cloração e limpeza', 'Sem foco típico (água limpa/tratada); manter cloração e limpeza; registrar para auditoria.', 'piscina_limpa', 21
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'piscina_limpa'
  );

  -- Caixa d'água fechada (YOLO)
  INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
  SELECT p_cliente_id, 'Registrar reservatório vedado', 'Sem foco típico (reservatório vedado); registrar para auditoria; reclassificar se houver indício de brechas.', 'caixa_dagua_fechada', 22
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item = 'caixa_dagua_fechada'
  );
END;
$$;

COMMENT ON FUNCTION public.seed_plano_acao_catalogo_por_tipo(uuid) IS
  'Insere ações específicas por tipo de item (espelho dos item_key do YOLO config). '
  'Idempotente por tipo_item: não duplica se já existir entrada para aquele tipo.';

-- -----------------------------------------------------------------------------
-- 2. Atualiza textos de catálogo já existentes para piscina_suja
-- -----------------------------------------------------------------------------
UPDATE public.plano_acao_catalogo
SET
  label = 'Tratamento e limpeza da piscina suja',
  descricao = 'Vistoria imediata; tratamento da água, limpeza e orientação ao responsável.'
WHERE tipo_item = 'piscina_suja';

-- -----------------------------------------------------------------------------
-- 3. Backfill YOLO: novas classes por cliente
-- -----------------------------------------------------------------------------
INSERT INTO public.sentinela_yolo_class_config (cliente_id, item_key, item, risco, peso, acao, is_active)
SELECT c.id,
  'piscina_limpa',
  'Piscina limpa',
  'baixo',
  15,
  'Sem foco típico (água limpa/tratada) | Manter cloração e limpeza | Registrar para auditoria',
  true
FROM public.clientes c
WHERE NOT EXISTS (
  SELECT 1 FROM public.sentinela_yolo_class_config y
  WHERE y.cliente_id = c.id AND y.item_key = 'piscina_limpa'
);

INSERT INTO public.sentinela_yolo_class_config (cliente_id, item_key, item, risco, peso, acao, is_active)
SELECT c.id,
  'caixa_dagua_fechada',
  'Caixa d''água fechada',
  'baixo',
  15,
  'Sem foco típico (reservatório vedado) | Registrar para auditoria | Reclassificar se houver indício de brechas',
  true
FROM public.clientes c
WHERE NOT EXISTS (
  SELECT 1 FROM public.sentinela_yolo_class_config y
  WHERE y.cliente_id = c.id AND y.item_key = 'caixa_dagua_fechada'
);

-- -----------------------------------------------------------------------------
-- 4. Alinha piscina_suja existente ao seed TS
-- -----------------------------------------------------------------------------
UPDATE public.sentinela_yolo_class_config
SET
  item = 'Piscina suja',
  risco = 'alto',
  peso = 90,
  acao = 'Vistoria imediata | Tratamento da água | Limpeza | Orientar responsável',
  updated_at = now()
WHERE item_key = 'piscina_suja';

-- -----------------------------------------------------------------------------
-- 5. Sinônimos PT (mesmo mapeamento que seedDefaultDroneRiskConfig.ts)
-- -----------------------------------------------------------------------------
INSERT INTO public.sentinela_yolo_synonym (cliente_id, synonym, maps_to)
SELECT c.id, v.synonym, v.maps_to
FROM public.clientes c
CROSS JOIN (
  VALUES
    ('caixa_agua', 'caixa_dagua'),
    ('caixa_agua_aberta', 'caixa_dagua'),
    ('pneu_velho', 'pneu'),
    ('piscina_verde', 'piscina_suja'),
    ('agua_parada', 'poca')
) AS v(synonym, maps_to)
WHERE NOT EXISTS (
  SELECT 1 FROM public.sentinela_yolo_synonym y
  WHERE y.cliente_id = c.id AND y.synonym = v.synonym
);

-- -----------------------------------------------------------------------------
-- 6. Catálogo por tipo para todos os clientes (novos tipos + idempotente)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.clientes LOOP
    PERFORM public.seed_plano_acao_catalogo_por_tipo(r.id);
  END LOOP;
END;
$$;
