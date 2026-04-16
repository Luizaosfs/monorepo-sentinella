-- =============================================================================
-- 20261015000003 — Limpeza definitiva do enum papel_app
--
-- Remove valores mortos (operador, usuario, platform_admin) do tipo enum.
-- Recria o tipo com apenas os 4 valores canônicos: admin, supervisor, agente, notificador.
--
-- PRÉ-REQUISITOS:
--   20261015000001 aplicada (dados migrados, chk_papel_canonico ativa)
--   20261015000002 aplicada (is_operador() removida)
--
-- ESTRATÉGIA (shadow column — única forma que funciona com RLS no PostgreSQL):
--   ALTER TABLE ... ALTER COLUMN TYPE falha com "cannot alter type of a column
--   used in a policy definition". A solução é:
--     1. Criar enum limpo (papel_app_v2)
--     2. Adicionar coluna shadow com novo tipo
--     3. Popular e promover a shadow column
--     4. DROP TYPE papel_app CASCADE (remove tem_papel + policies dependentes)
--     5. Renomear papel_app_v2 → papel_app
--     6. Recriar tem_papel() e todas as policies afetadas
--
-- BUG CORRIGIDO: papel_permitido_para_supervisor() ainda permitia 'operador'
--   (valor morto). Corrigido para 'agente' nesta migration.
--
-- OBJETOS AFETADOS:
--   Tipo:      papel_app (recreated), papel_app_v2 (transitório)
--   Coluna:    papeis_usuarios.papel (tipo trocado, dados preservados)
--   Função:    tem_papel(uuid, papel_app) (recreated)
--   Função:    papel_permitido_para_supervisor(text) (bug fix: operador→agente)
--   Políticas: 19 policies em 7 tabelas (drop + recreate idêntico, novo tipo)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1: Criar novo tipo com apenas os 4 valores canônicos
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE public.papel_app_v2 AS ENUM (
  'admin',
  'supervisor',
  'agente',
  'notificador'
);

COMMENT ON TYPE public.papel_app_v2 IS 'Transitório — será renomeado para papel_app ao final desta migration.';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2: Shadow column — adicionar, popular, marcar NOT NULL
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.papeis_usuarios ADD COLUMN papel_v2 public.papel_app_v2;

-- Desabilitar trigger que dispara em UPDATE e valida NEW.papel (usa coluna antiga).
-- Será recriado em fase posterior com a nova coluna.
DROP TRIGGER IF EXISTS trg_validar_admin_sem_cliente ON public.papeis_usuarios;

UPDATE public.papeis_usuarios
SET papel_v2 = papel::text::public.papel_app_v2;

-- Verificar que não ficou NULL (chk_papel_canonico garante que todos os valores
-- já são canônicos, mas a assert é defensiva)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.papeis_usuarios WHERE papel_v2 IS NULL) THEN
    RAISE EXCEPTION 'FALHA: papel_v2 NULL encontrado após UPDATE. '
      'Verifique se 20261015000001 foi aplicada (dados devem ser canônicos).';
  END IF;
END;
$$;

ALTER TABLE public.papeis_usuarios ALTER COLUMN papel_v2 SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 3: Remover tudo que depende de papeis_usuarios.papel (coluna antiga)
--         para poder fazer DROP COLUMN
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Políticas em papeis_usuarios que referenciam a coluna papel
DROP POLICY IF EXISTS "papeis_usuarios_select" ON public.papeis_usuarios;
DROP POLICY IF EXISTS "papeis_usuarios_insert" ON public.papeis_usuarios;
DROP POLICY IF EXISTS "papeis_usuarios_update" ON public.papeis_usuarios;
DROP POLICY IF EXISTS "papeis_usuarios_delete" ON public.papeis_usuarios;

-- 3b. Constraints sobre a coluna papel
ALTER TABLE public.papeis_usuarios DROP CONSTRAINT IF EXISTS chk_papel_canonico;
ALTER TABLE public.papeis_usuarios DROP CONSTRAINT IF EXISTS papeis_sem_platform_admin;

-- 3c. Trigger já removido antes do UPDATE na Fase 2 (ver acima)

-- 3d. Dropar a coluna antiga (CASCADE cobre qualquer dependente restante)
ALTER TABLE public.papeis_usuarios DROP COLUMN papel CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 4: Promover shadow column
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.papeis_usuarios RENAME COLUMN papel_v2 TO papel;

-- Recriar constraints (agora sobre a coluna do tipo papel_app_v2)
ALTER TABLE public.papeis_usuarios
  ADD CONSTRAINT chk_papel_canonico
  CHECK (papel::text = ANY (ARRAY['admin', 'supervisor', 'agente', 'notificador']));

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 5: Dropar o tipo antigo com CASCADE
--
-- Objetos que serão dropados automaticamente:
--   - tem_papel(uuid, papel_app)              — dep. direta no tipo
--   - "Admins atualizam clientes"             — dep. em tem_papel
--   - "Admins atualizam itens"                — dep. em tem_papel
--   - "Admins atualizam levantamentos"        — dep. em tem_papel
--   - "Admins deletam clientes"               — dep. em tem_papel
--   - "Admins deletam itens"                  — dep. em tem_papel
--   - "Admins deletam levantamentos"          — dep. em tem_papel
--   - "Admins inserem clientes"               — dep. em tem_papel
--   - "Admins inserem itens"                  — dep. em tem_papel
--   - "Admins inserem levantamentos"          — dep. em tem_papel
--   - "Usuarios veem itens do seu cliente"    — dep. em tem_papel
--   - "Usuarios veem levantamentos do seu cliente" — dep. em tem_papel
--   - "Usuarios veem seu proprio cliente"     — dep. em tem_papel
--   - "Admins full access sla"                — inline ::papel_app
--   - "admin_all_yolo_class_config"           — inline ::papel_app
--   - "admin_all_yolo_synonym"                — inline ::papel_app
--   - "alerts_admin_leitura"                  — inline ::papel_app
--   - "alerts_admin_update"                   — inline ::papel_app
--   - "cliente_quotas_insert"                 — inline ::papel_app
--   - "cliente_quotas_update"                 — inline ::papel_app
--
-- papeis_usuarios.papel NÃO é afetado (já é papel_app_v2)
-- ─────────────────────────────────────────────────────────────────────────────

DROP TYPE public.papel_app CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 6: Renomear tipo novo para o nome canônico
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE public.papel_app_v2 RENAME TO papel_app;

COMMENT ON TYPE public.papel_app IS
  'Enum canônico final. Valores: admin, supervisor, agente, notificador. '
  'Nenhum valor morto. Limpeza concluída em migration 20261015000003.';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 7: Recriar trigger em papeis_usuarios
-- (fn_validar_admin_sem_cliente usa NEW.papel::text — funciona com qualquer enum)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_validar_admin_sem_cliente
  BEFORE INSERT OR UPDATE ON public.papeis_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_admin_sem_cliente();

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 8: Recriar políticas em papeis_usuarios
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "papeis_usuarios_select" ON public.papeis_usuarios
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
  );

CREATE POLICY "papeis_usuarios_insert" ON public.papeis_usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.supervisor_pode_gerir_usuario(usuario_id)
      AND public.papel_permitido_para_supervisor(papel::text)
    )
  );

CREATE POLICY "papeis_usuarios_update" ON public.papeis_usuarios
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.supervisor_pode_gerir_usuario(usuario_id)
      AND public.papel_permitido_para_supervisor(papel::text)
    )
  );

CREATE POLICY "papeis_usuarios_delete" ON public.papeis_usuarios
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 9: Corrigir papel_permitido_para_supervisor()
-- BUG: corpo antigo permitia 'operador' — valor morto há meses
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.papel_permitido_para_supervisor(p_papel text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(p_papel) IN ('agente', 'notificador');
$$;

COMMENT ON FUNCTION public.papel_permitido_para_supervisor(text) IS
  'Papéis que supervisor pode atribuir a usuários do próprio cliente. '
  'Valores permitidos: agente, notificador. '
  'Excluídos: admin, supervisor (escalam privilégio), operador (valor morto).';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 10: Recriar tem_papel() com o novo tipo
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tem_papel(
  _usuario_id uuid,
  _papel      public.papel_app
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.papeis_usuarios
    WHERE usuario_id = _usuario_id
      AND papel = _papel
  );
$$;

REVOKE ALL ON FUNCTION public.tem_papel(uuid, public.papel_app) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tem_papel(uuid, public.papel_app) TO anon;
GRANT ALL ON FUNCTION public.tem_papel(uuid, public.papel_app) TO authenticated;
GRANT ALL ON FUNCTION public.tem_papel(uuid, public.papel_app) TO service_role;

COMMENT ON FUNCTION public.tem_papel(uuid, public.papel_app) IS
  'Retorna true se o usuário tem o papel indicado em papeis_usuarios. '
  'Tipo atualizado para papel_app canônico (sem valores mortos).';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 11: Recriar 19 políticas dropadas pelo CASCADE
-- Texto reconstruído literalmente do schema.sql — sem alteração de lógica
-- ─────────────────────────────────────────────────────────────────────────────

-- ── clientes ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins inserem clientes" ON public.clientes;
CREATE POLICY "Admins inserem clientes" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_papel(auth.uid(), 'admin'::public.papel_app));

DROP POLICY IF EXISTS "Admins atualizam clientes" ON public.clientes;
CREATE POLICY "Admins atualizam clientes" ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.tem_papel(auth.uid(), 'admin'::public.papel_app))
  WITH CHECK (public.tem_papel(auth.uid(), 'admin'::public.papel_app));

DROP POLICY IF EXISTS "Admins deletam clientes" ON public.clientes;
CREATE POLICY "Admins deletam clientes" ON public.clientes
  FOR DELETE TO authenticated
  USING (public.tem_papel(auth.uid(), 'admin'::public.papel_app));

DROP POLICY IF EXISTS "Usuarios veem seu proprio cliente" ON public.clientes;
CREATE POLICY "Usuarios veem seu proprio cliente" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT cliente_id FROM public.usuarios WHERE auth_id = auth.uid())
    OR public.tem_papel(auth.uid(), 'admin'::public.papel_app)
  );

-- ── levantamento_itens ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins inserem itens" ON public.levantamento_itens;
CREATE POLICY "Admins inserem itens" ON public.levantamento_itens
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_papel(auth.uid(), 'admin'::public.papel_app));

DROP POLICY IF EXISTS "Admins atualizam itens" ON public.levantamento_itens;
CREATE POLICY "Admins atualizam itens" ON public.levantamento_itens
  FOR UPDATE TO authenticated
  USING (public.tem_papel(auth.uid(), 'admin'::public.papel_app))
  WITH CHECK (public.tem_papel(auth.uid(), 'admin'::public.papel_app));

DROP POLICY IF EXISTS "Admins deletam itens" ON public.levantamento_itens;
CREATE POLICY "Admins deletam itens" ON public.levantamento_itens
  FOR DELETE TO authenticated
  USING (public.tem_papel(auth.uid(), 'admin'::public.papel_app));

DROP POLICY IF EXISTS "Usuarios veem itens do seu cliente" ON public.levantamento_itens;
CREATE POLICY "Usuarios veem itens do seu cliente" ON public.levantamento_itens
  FOR SELECT TO authenticated
  USING (
    levantamento_id IN (
      SELECT l.id FROM public.levantamentos l
      JOIN public.usuarios u ON u.cliente_id = l.cliente_id
      WHERE u.auth_id = auth.uid()
    )
    OR public.tem_papel(auth.uid(), 'admin'::public.papel_app)
  );

-- ── levantamentos ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins inserem levantamentos" ON public.levantamentos;
CREATE POLICY "Admins inserem levantamentos" ON public.levantamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_papel(auth.uid(), 'admin'::public.papel_app));

DROP POLICY IF EXISTS "Admins atualizam levantamentos" ON public.levantamentos;
CREATE POLICY "Admins atualizam levantamentos" ON public.levantamentos
  FOR UPDATE TO authenticated
  USING (public.tem_papel(auth.uid(), 'admin'::public.papel_app))
  WITH CHECK (public.tem_papel(auth.uid(), 'admin'::public.papel_app));

DROP POLICY IF EXISTS "Admins deletam levantamentos" ON public.levantamentos;
CREATE POLICY "Admins deletam levantamentos" ON public.levantamentos
  FOR DELETE TO authenticated
  USING (public.tem_papel(auth.uid(), 'admin'::public.papel_app));

DROP POLICY IF EXISTS "Usuarios veem levantamentos do seu cliente" ON public.levantamentos;
CREATE POLICY "Usuarios veem levantamentos do seu cliente" ON public.levantamentos
  FOR SELECT TO authenticated
  USING (
    cliente_id IN (SELECT cliente_id FROM public.usuarios WHERE auth_id = auth.uid())
    OR public.tem_papel(auth.uid(), 'admin'::public.papel_app)
  );

-- ── sla_operacional ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins full access sla" ON public.sla_operacional;
CREATE POLICY "Admins full access sla" ON public.sla_operacional
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios
      WHERE usuario_id = auth.uid()
        AND papel = 'admin'::public.papel_app
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios
      WHERE usuario_id = auth.uid()
        AND papel = 'admin'::public.papel_app
    )
  );

-- ── sentinela_yolo_class_config ───────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_all_yolo_class_config" ON public.sentinela_yolo_class_config;
CREATE POLICY "admin_all_yolo_class_config" ON public.sentinela_yolo_class_config
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel = 'admin'::public.papel_app
    )
  );

-- ── sentinela_yolo_synonym ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_all_yolo_synonym" ON public.sentinela_yolo_synonym;
CREATE POLICY "admin_all_yolo_synonym" ON public.sentinela_yolo_synonym
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel = 'admin'::public.papel_app
    )
  );

-- ── system_alerts ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "alerts_admin_leitura" ON public.system_alerts;
CREATE POLICY "alerts_admin_leitura" ON public.system_alerts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel = ANY (
          ARRAY['admin'::public.papel_app, 'supervisor'::public.papel_app]
        )
    )
  );

DROP POLICY IF EXISTS "alerts_admin_update" ON public.system_alerts;
CREATE POLICY "alerts_admin_update" ON public.system_alerts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel = 'admin'::public.papel_app
    )
  );

-- ── cliente_quotas ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cliente_quotas_insert" ON public.cliente_quotas;
CREATE POLICY "cliente_quotas_insert" ON public.cliente_quotas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel = 'admin'::public.papel_app
    )
  );

DROP POLICY IF EXISTS "cliente_quotas_update" ON public.cliente_quotas;
CREATE POLICY "cliente_quotas_update" ON public.cliente_quotas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel = 'admin'::public.papel_app
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel = 'admin'::public.papel_app
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 12: Verificação final
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_enum_values   text;
  v_legados       integer;
  v_tipo_coluna   text;
  v_tem_papel_ok  boolean;
  v_mortos_no_enum text[];
BEGIN
  -- 12a. Verificar valores do enum papel_app
  SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder)
  INTO v_enum_values
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname = 'papel_app';

  IF v_enum_values IS DISTINCT FROM 'admin, supervisor, agente, notificador' THEN
    RAISE EXCEPTION
      'FALHA: enum papel_app contém valores inesperados: [%]. '
      'Esperado: [admin, supervisor, agente, notificador]',
      v_enum_values;
  END IF;

  -- 12b. Verificar que a coluna papeis_usuarios.papel usa o novo tipo
  SELECT udt_name INTO v_tipo_coluna
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'papeis_usuarios'
    AND column_name = 'papel';

  IF v_tipo_coluna <> 'papel_app' THEN
    RAISE EXCEPTION
      'FALHA: coluna papeis_usuarios.papel tem tipo [%], esperado papel_app.',
      v_tipo_coluna;
  END IF;

  -- 12c. Verificar dados limpos
  SELECT COUNT(*) INTO v_legados
  FROM public.papeis_usuarios
  WHERE papel::text NOT IN ('admin', 'supervisor', 'agente', 'notificador');

  IF v_legados > 0 THEN
    RAISE EXCEPTION
      'FALHA: % registro(s) com papel fora dos canônicos em papeis_usuarios.',
      v_legados;
  END IF;

  -- 12d. Verificar que tem_papel() existe com a nova assinatura
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'tem_papel'
  ) INTO v_tem_papel_ok;

  IF NOT v_tem_papel_ok THEN
    RAISE EXCEPTION 'FALHA: tem_papel() não encontrada após recreate.';
  END IF;

  -- 12e. Verificar que papel_app_v2 não existe mais (foi renomeado)
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'papel_app_v2'
  ) THEN
    RAISE EXCEPTION 'FALHA: tipo papel_app_v2 ainda existe — rename falhou.';
  END IF;

  RAISE NOTICE
    '20261015000003 — OK. '
    'enum papel_app: [%]. '
    'Coluna tipo: %. '
    'Dados legados: %. '
    'tem_papel: OK.',
    v_enum_values, v_tipo_coluna, v_legados;
END;
$$;
