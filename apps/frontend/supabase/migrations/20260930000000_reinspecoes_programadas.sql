-- ─────────────────────────────────────────────────────────────────────────────
-- GAP P0: Reinspeção Programada Pós-Tratamento
-- Migration: 20260930000000_reinspecoes_programadas.sql
--
-- Implementa o loop formal de verificação de eficácia:
--   confirmado → em_tratamento → reinspeção → resolvido | persiste (loop)
--
-- Regras:
--   - Ao entrar em em_tratamento → trigger cria reinspecao pendente (7 dias)
--   - Ao resolver/descartar foco → trigger cancela reinspecoes pendentes
--   - Reinspecao pendente com data_prevista < now() → vira vencida (fn_marcar_reinspecoes_vencidas)
--   - Apenas 1 reinspecao pendente por foco+tipo (unique partial index)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enums
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE reinspecao_status AS ENUM ('pendente', 'realizada', 'cancelada', 'vencida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reinspecao_tipo AS ENUM ('eficacia_pos_tratamento', 'retorno_operacional');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reinspecao_resultado AS ENUM ('resolvido', 'persiste', 'nao_realizado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tabela principal
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reinspecoes_programadas (
  id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          uuid            NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  foco_risco_id       uuid            NOT NULL REFERENCES focos_risco(id) ON DELETE CASCADE,
  status              reinspecao_status NOT NULL DEFAULT 'pendente',
  tipo                reinspecao_tipo   NOT NULL DEFAULT 'eficacia_pos_tratamento',
  -- 'automatico' = criado por trigger; 'manual' = criado pelo supervisor
  origem              text            NOT NULL DEFAULT 'automatico'
                        CHECK (origem IN ('automatico', 'manual')),
  data_prevista       timestamptz     NOT NULL,
  data_realizada      timestamptz,
  responsavel_id      uuid            REFERENCES usuarios(id) ON DELETE SET NULL,
  observacao          text,
  resultado           reinspecao_resultado,
  criado_por          uuid            REFERENCES usuarios(id) ON DELETE SET NULL,
  cancelado_por       uuid            REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo_cancelamento text,
  created_at          timestamptz     NOT NULL DEFAULT now(),
  updated_at          timestamptz     NOT NULL DEFAULT now()
);

-- 3. Índices
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_reinspecoes_cliente_id
  ON reinspecoes_programadas (cliente_id);

CREATE INDEX IF NOT EXISTS idx_reinspecoes_foco_risco_id
  ON reinspecoes_programadas (foco_risco_id);

CREATE INDEX IF NOT EXISTS idx_reinspecoes_responsavel_status
  ON reinspecoes_programadas (responsavel_id, status)
  WHERE responsavel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reinspecoes_cliente_status_data
  ON reinspecoes_programadas (cliente_id, status, data_prevista);

-- Garante no máximo 1 reinspeção pendente por foco+tipo (idempotência)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reinspecao_pendente_unica
  ON reinspecoes_programadas (foco_risco_id, tipo)
  WHERE (status = 'pendente');

-- 4. RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE reinspecoes_programadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinspecoes_isolamento_por_cliente" ON reinspecoes_programadas;
CREATE POLICY "reinspecoes_isolamento_por_cliente"
  ON reinspecoes_programadas
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- 5. Trigger: updated_at
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_reinspecoes_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reinspecoes_updated_at ON reinspecoes_programadas;
CREATE TRIGGER trg_reinspecoes_updated_at
  BEFORE UPDATE ON reinspecoes_programadas
  FOR EACH ROW EXECUTE FUNCTION fn_reinspecoes_set_updated_at();

-- 6. Trigger: auto-criar reinspeção ao foco entrar em em_tratamento
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_criar_reinspecao_pos_tratamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só dispara na transição *para* em_tratamento (não re-entrada)
  IF NEW.status = 'em_tratamento'
     AND (OLD.status IS DISTINCT FROM 'em_tratamento')
  THEN
    INSERT INTO reinspecoes_programadas (
      cliente_id,
      foco_risco_id,
      status,
      tipo,
      origem,
      data_prevista,
      responsavel_id,
      criado_por
    )
    VALUES (
      NEW.cliente_id,
      NEW.id,
      'pendente',
      'eficacia_pos_tratamento',
      'automatico',
      now() + interval '7 days',  -- prazo padrão: 7 dias
      NEW.responsavel_id,
      NEW.responsavel_id
    )
    -- Idempotência: se já existir uma pendente, ignora
    ON CONFLICT (foco_risco_id, tipo)
    WHERE (status = 'pendente')
    DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_reinspecao_pos_tratamento ON focos_risco;
CREATE TRIGGER trg_criar_reinspecao_pos_tratamento
  AFTER UPDATE ON focos_risco
  FOR EACH ROW
  EXECUTE FUNCTION fn_criar_reinspecao_pos_tratamento();

-- 7. Trigger: cancelar reinspeções pendentes ao fechar o foco
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_cancelar_reinspecoes_ao_fechar_foco()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Dispara quando foco vai para resolvido ou descartado
  IF NEW.status IN ('resolvido', 'descartado')
     AND OLD.status NOT IN ('resolvido', 'descartado')
  THEN
    UPDATE reinspecoes_programadas
    SET
      status              = 'cancelada',
      motivo_cancelamento = 'Foco encerrado automaticamente (' || NEW.status || ')',
      cancelado_por       = NEW.responsavel_id,
      updated_at          = now()
    WHERE foco_risco_id = NEW.id
      AND status        = 'pendente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancelar_reinspecoes_ao_fechar_foco ON focos_risco;
CREATE TRIGGER trg_cancelar_reinspecoes_ao_fechar_foco
  AFTER UPDATE ON focos_risco
  FOR EACH ROW
  EXECUTE FUNCTION fn_cancelar_reinspecoes_ao_fechar_foco();

-- 8. Função utilitária: marcar vencidas (chamada por cron ou sob demanda)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_marcar_reinspecoes_vencidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE reinspecoes_programadas
  SET    status     = 'vencida',
         updated_at = now()
  WHERE  status        = 'pendente'
    AND  data_prevista < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 9. RPC: registrar resultado de uma reinspeção (usado pelo agente)
-- ─────────────────────────────────────────────────────────────────────────────
-- Retorna: { ok, reinspecao_id, resultado, foco_id, foco_status, pode_resolver_foco }
-- Se pode_resolver_foco = true, o supervisor pode chamar rpc_transicionar_foco_risco → 'resolvido'

CREATE OR REPLACE FUNCTION rpc_registrar_reinspecao_resultado(
  p_reinspecao_id  uuid,
  p_resultado      reinspecao_resultado,
  p_observacao     text         DEFAULT NULL,
  p_data_realizada timestamptz  DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r reinspecoes_programadas%ROWTYPE;
  v_f focos_risco%ROWTYPE;
BEGIN
  -- Bloqueia e carrega a reinspeção
  SELECT * INTO v_r
  FROM   reinspecoes_programadas
  WHERE  id = p_reinspecao_id
  FOR    UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reinspeção não encontrada');
  END IF;

  -- Verifica acesso multi-tenant
  IF NOT public.usuario_pode_acessar_cliente(v_r.cliente_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acesso negado');
  END IF;

  -- Só pode registrar resultado em pendente ou vencida
  IF v_r.status NOT IN ('pendente', 'vencida') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Reinspeção não está em estado executável (status atual: ' || v_r.status || ')');
  END IF;

  SELECT * INTO v_f FROM focos_risco WHERE id = v_r.foco_risco_id;

  UPDATE reinspecoes_programadas
  SET
    status         = 'realizada',
    resultado      = p_resultado,
    observacao     = COALESCE(p_observacao, observacao),
    data_realizada = p_data_realizada,
    updated_at     = now()
  WHERE id = p_reinspecao_id;

  RETURN jsonb_build_object(
    'ok',               true,
    'reinspecao_id',    p_reinspecao_id,
    'resultado',        p_resultado,
    'foco_id',          v_r.foco_risco_id,
    'foco_status',      v_f.status,
    -- Sinaliza para o frontend que o foco pode ser resolvido agora
    'pode_resolver_foco', (
      p_resultado = 'resolvido'
      AND v_f.status = 'em_tratamento'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_registrar_reinspecao_resultado TO authenticated;

-- 10. RPC: criar reinspeção manual (supervisor/admin)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_criar_reinspecao_manual(
  p_foco_risco_id  uuid,
  p_tipo           reinspecao_tipo  DEFAULT 'eficacia_pos_tratamento',
  p_data_prevista  timestamptz      DEFAULT (now() + interval '7 days'),
  p_responsavel_id uuid             DEFAULT NULL,
  p_observacao     text             DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_f  focos_risco%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_f FROM focos_risco WHERE id = p_foco_risco_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Foco não encontrado');
  END IF;

  IF NOT public.usuario_pode_acessar_cliente(v_f.cliente_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acesso negado');
  END IF;

  IF v_f.status NOT IN ('confirmado', 'em_tratamento') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Reinspeção só pode ser criada para focos confirmados ou em tratamento');
  END IF;

  IF p_data_prevista < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Data prevista não pode ser no passado');
  END IF;

  INSERT INTO reinspecoes_programadas (
    cliente_id, foco_risco_id, status, tipo, origem,
    data_prevista, responsavel_id, observacao, criado_por
  )
  VALUES (
    v_f.cliente_id, p_foco_risco_id, 'pendente', p_tipo, 'manual',
    p_data_prevista, p_responsavel_id, p_observacao, auth.uid()
  )
  ON CONFLICT (foco_risco_id, tipo) WHERE (status = 'pendente')
  DO UPDATE SET
    data_prevista  = EXCLUDED.data_prevista,
    responsavel_id = EXCLUDED.responsavel_id,
    observacao     = COALESCE(EXCLUDED.observacao, reinspecoes_programadas.observacao),
    origem         = 'manual',
    updated_at     = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_criar_reinspecao_manual TO authenticated;

-- 11. RPC: cancelar reinspeção manualmente
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_cancelar_reinspecao(
  p_reinspecao_id       uuid,
  p_motivo_cancelamento text DEFAULT 'Cancelado manualmente'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r reinspecoes_programadas%ROWTYPE;
BEGIN
  SELECT * INTO v_r
  FROM   reinspecoes_programadas
  WHERE  id = p_reinspecao_id
  FOR    UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reinspeção não encontrada');
  END IF;

  IF NOT public.usuario_pode_acessar_cliente(v_r.cliente_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acesso negado');
  END IF;

  IF v_r.status NOT IN ('pendente', 'vencida') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Só é possível cancelar reinspeções pendentes ou vencidas');
  END IF;

  UPDATE reinspecoes_programadas
  SET
    status              = 'cancelada',
    motivo_cancelamento = p_motivo_cancelamento,
    cancelado_por       = auth.uid(),
    updated_at          = now()
  WHERE id = p_reinspecao_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_cancelar_reinspecao TO authenticated;

-- 12. Reagendar reinspeção
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_reagendar_reinspecao(
  p_reinspecao_id  uuid,
  p_nova_data      timestamptz,
  p_responsavel_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r reinspecoes_programadas%ROWTYPE;
BEGIN
  SELECT * INTO v_r
  FROM   reinspecoes_programadas
  WHERE  id = p_reinspecao_id
  FOR    UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reinspeção não encontrada');
  END IF;

  IF NOT public.usuario_pode_acessar_cliente(v_r.cliente_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acesso negado');
  END IF;

  IF v_r.status NOT IN ('pendente', 'vencida') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Só é possível reagendar reinspeções pendentes ou vencidas');
  END IF;

  IF p_nova_data < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nova data não pode ser no passado');
  END IF;

  UPDATE reinspecoes_programadas
  SET
    status         = 'pendente',      -- vencida volta para pendente ao reagendar
    data_prevista  = p_nova_data,
    responsavel_id = COALESCE(p_responsavel_id, responsavel_id),
    updated_at     = now()
  WHERE id = p_reinspecao_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_reagendar_reinspecao TO authenticated;

-- 13. Agendar verificação diária de vencidas via pg_cron
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;

  -- Remove job anterior se existir (ignora erro se não existir)
  BEGIN
    PERFORM cron.unschedule('marcar-reinspecoes-vencidas');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'marcar-reinspecoes-vencidas',
    '0 6 * * *',
    $cron$SELECT fn_marcar_reinspecoes_vencidas()$cron$
  );
END $$;
