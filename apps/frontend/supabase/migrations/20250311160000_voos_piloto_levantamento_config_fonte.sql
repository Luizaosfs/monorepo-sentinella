-- =============================================================================
-- Voos — Piloto responsável + Levantamento — Fonte de configuração
--
-- 4.1: levantamentos.config_fonte — registra se o pipeline usou configuração
--      do Supabase ou do JSON local (fallback). Permite auditoria e alertas.
--
-- 4.2: voos.piloto_id — FK para usuarios; vincula o voo a quem o executou.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4.1: config_fonte em levantamentos
-- Valores esperados:
--   'supabase'         — toda configuração veio do banco (situação ideal)
--   'local_json'       — fallback total para JSONs locais
--   'local_json:yolo'  — yolo_map veio do JSON local (risk_params do Supabase)
--   'local_json:risk'  — risk_params veio do JSON local (yolo do Supabase)
--   'local_json:sla'   — sla_config veio do JSON local
--   NULL               — não informado (levantamentos anteriores)
-- -----------------------------------------------------------------------------
ALTER TABLE public.levantamentos
  ADD COLUMN IF NOT EXISTS config_fonte text;

COMMENT ON COLUMN public.levantamentos.config_fonte IS
  'Fonte da configuração usada no processamento do pipeline drone. '
  '''supabase'' = configuração veio do banco (ideal). '
  '''local_json'' (ou variantes com sufixo) = fallback para JSON local, '
  'indicando que a config do cliente no Supabase estava ausente ou inacessível.';

-- Índice para filtrar levantamentos com config degradada no dashboard
CREATE INDEX IF NOT EXISTS levantamentos_config_fonte_idx
  ON public.levantamentos (config_fonte)
  WHERE config_fonte IS NOT NULL AND config_fonte <> 'supabase';

-- -----------------------------------------------------------------------------
-- 4.2: piloto_id em voos
-- -----------------------------------------------------------------------------
ALTER TABLE public.voos
  ADD COLUMN IF NOT EXISTS piloto_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.voos.piloto_id IS
  'Usuário que executou o voo (piloto / operador responsável). '
  'Preenchido pelo pipeline Python via supabase_auth.get_current_usuario().';

CREATE INDEX IF NOT EXISTS voos_piloto_id_idx
  ON public.voos (piloto_id)
  WHERE piloto_id IS NOT NULL;
