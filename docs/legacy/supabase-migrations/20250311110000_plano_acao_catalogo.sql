-- =============================================================================
-- Plano de Ação Catálogo
-- Catálogo de ações corretivas configurável por cliente (prefeitura).
-- Substitui o campo texto livre acao_aplicada por uma seleção padronizada,
-- mantendo acao_aplicada como texto para observações livres complementares.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plano_acao_catalogo (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  label       text        NOT NULL,
  descricao   text,
  tipo_item   text,       -- NULL = vale para qualquer tipo; ou filtra por item (ex: 'pneu', 'caixa_dagua')
  ativo       boolean     NOT NULL DEFAULT true,
  ordem       int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plano_acao_catalogo IS
  'Catálogo de ações corretivas por cliente. '
  'Operador seleciona uma ação ao concluir o atendimento de um item. '
  'tipo_item NULL significa que a ação se aplica a qualquer tipo de item.';

COMMENT ON COLUMN public.plano_acao_catalogo.tipo_item IS
  'Filtro opcional por tipo de item (campo item em levantamento_itens). '
  'NULL = ação genérica, aparece para qualquer tipo.';

CREATE INDEX IF NOT EXISTS plano_acao_catalogo_cliente_idx
  ON public.plano_acao_catalogo (cliente_id, ativo, ordem);

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.plano_acao_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plano_acao_catalogo_select" ON public.plano_acao_catalogo;
CREATE POLICY "plano_acao_catalogo_select" ON public.plano_acao_catalogo
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "plano_acao_catalogo_insert" ON public.plano_acao_catalogo;
CREATE POLICY "plano_acao_catalogo_insert" ON public.plano_acao_catalogo
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "plano_acao_catalogo_update" ON public.plano_acao_catalogo;
CREATE POLICY "plano_acao_catalogo_update" ON public.plano_acao_catalogo
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "plano_acao_catalogo_delete" ON public.plano_acao_catalogo;
CREATE POLICY "plano_acao_catalogo_delete" ON public.plano_acao_catalogo
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_acao_catalogo TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Função de seed
-- Insere ações padrão de combate à dengue para um novo cliente.
-- Idempotente: não duplica se já existirem ações para o cliente.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_plano_acao_catalogo(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só semeia se o cliente ainda não tiver nenhuma ação cadastrada
  IF EXISTS (SELECT 1 FROM public.plano_acao_catalogo WHERE cliente_id = p_cliente_id) THEN
    RETURN;
  END IF;

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
END;
$$;

COMMENT ON FUNCTION public.seed_plano_acao_catalogo(uuid) IS
  'Popula o catálogo de ações padrão de combate à dengue para um cliente. '
  'Idempotente: não duplica se já existirem ações cadastradas.';

-- -----------------------------------------------------------------------------
-- 4. Trigger: seed automático ao criar cliente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_seed_plano_acao_catalogo_on_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_plano_acao_catalogo(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_plano_acao_catalogo_on_cliente ON public.clientes;

CREATE TRIGGER trg_seed_plano_acao_catalogo_on_cliente
  AFTER INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_plano_acao_catalogo_on_cliente();
