-- =============================================================================
-- Plano de Ação Catálogo — ações por tipo de item (baseadas no YOLO config)
-- Adiciona entradas com tipo_item preenchido, espelhando DEFAULT_YOLO_CLASSES
-- do frontend e sentinela_yolo_class_config do Python.
-- Atualiza seed_plano_acao_catalogo para incluir essas ações na criação de cliente.
-- Aplica retroativamente para clientes existentes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Função auxiliar: insere ações por tipo sem duplicar
-- Segura para rodar em clientes já existentes (verifica por label+tipo_item).
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
  SELECT p_cliente_id, 'Tratar e drenar a piscina', 'Aplicar produto clareante/larvicida e drenar a piscina; orientar responsável sobre manutenção.', 'piscina_suja', 13
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
END;
$$;

COMMENT ON FUNCTION public.seed_plano_acao_catalogo_por_tipo(uuid) IS
  'Insere ações específicas por tipo de item (espelho dos item_key do YOLO config). '
  'Idempotente por tipo_item: não duplica se já existir entrada para aquele tipo.';

-- -----------------------------------------------------------------------------
-- 2. Atualiza seed_plano_acao_catalogo para chamar também o seed por tipo
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_plano_acao_catalogo(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ações genéricas (tipo_item NULL — aparecem para qualquer tipo)
  IF NOT EXISTS (SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id AND tipo_item IS NULL) THEN
    INSERT INTO public.plano_acao_catalogo (cliente_id, label, descricao, tipo_item, ordem)
    VALUES
      (p_cliente_id, 'Remoção de criadouro',               'Eliminação física do foco de reprodução do mosquito.',                             NULL,  1),
      (p_cliente_id, 'Aplicação de larvicida',              'Tratamento do foco com produto larvicida homologado.',                             NULL,  2),
      (p_cliente_id, 'Aplicação de adulticida',             'Nebulização ou pulverização para eliminar mosquitos adultos.',                     NULL,  3),
      (p_cliente_id, 'Tampa/vedação de reservatório',       'Instalação ou ajuste de tampa em caixas d''água, tambores e similares.',          NULL,  4),
      (p_cliente_id, 'Descarte de recipiente',              'Retirada e descarte adequado de recipientes acumuladores de água.',                NULL,  5),
      (p_cliente_id, 'Limpeza de calha ou sarjeta',         'Desobstrução de calhas, sarjetas e bueiros com água estagnada.',                  NULL,  6),
      (p_cliente_id, 'Orientação ao morador',               'Informação e conscientização do responsável pelo imóvel.',                        NULL,  7),
      (p_cliente_id, 'Notificação ao proprietário',         'Emissão de notificação formal ao proprietário do imóvel.',                        NULL,  8),
      (p_cliente_id, 'Encaminhamento à vigilância',         'Encaminhamento do caso à equipe de vigilância epidemiológica.',                   NULL,  9),
      (p_cliente_id, 'Visita de retorno agendada',          'Caso não solucionado; agendamento de nova visita para acompanhamento.',           NULL, 10);
  END IF;

  -- Ações por tipo de item (espelho do YOLO config)
  PERFORM public.seed_plano_acao_catalogo_por_tipo(p_cliente_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Aplica retroativamente para todos os clientes existentes
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
