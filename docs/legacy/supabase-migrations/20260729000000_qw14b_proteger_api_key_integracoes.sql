-- QW-14 Sprint B2 — Proteção da api_key em cliente_integracoes
--
-- Problemas corrigidos:
-- 1. RLS permitia qualquer usuário do cliente ler a api_key (incluindo operadores)
-- 2. api_key armazenada em texto plano — adicionamos mascaramento e restrição de leitura
--
-- Estratégia:
-- a) Restringir leitura da api_key a papel 'admin' ou 'supervisor' via RLS separada
-- b) Adicionar função de mascaramento para exibição segura
-- c) Adicionar coluna api_key_masked para leitura pública sem expor o segredo

-- ─── 1. Corrigir RLS — separar leitura de escrita ─────────────────────────────

-- Remove política genérica que deixava qualquer usuário do cliente ler
DROP POLICY IF EXISTS "isolamento_cliente_integracoes" ON cliente_integracoes;

-- Leitura: apenas admin e supervisor do cliente
-- (papel fica em papeis_usuarios, não em usuarios)
CREATE POLICY "leitura_admin_supervisor_integracoes" ON cliente_integracoes
  FOR SELECT
  USING (
    cliente_id IN (
      SELECT u.cliente_id FROM usuarios u
      JOIN papeis_usuarios pu ON pu.usuario_id = u.id
      WHERE u.auth_id = auth.uid()
        AND LOWER(pu.papel::text) IN ('admin', 'supervisor')
    )
  );

-- Escrita (INSERT/UPDATE/DELETE): apenas admin
CREATE POLICY "escrita_admin_integracoes" ON cliente_integracoes
  FOR ALL
  USING (
    cliente_id IN (
      SELECT u.cliente_id FROM usuarios u
      JOIN papeis_usuarios pu ON pu.usuario_id = u.id
      WHERE u.auth_id = auth.uid()
        AND LOWER(pu.papel::text) = 'admin'
    )
  );

-- ─── 2. Função de mascaramento para exibição segura ──────────────────────────

CREATE OR REPLACE FUNCTION mascarar_api_key(p_key text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_key IS NULL OR length(p_key) < 8
      THEN '****'
    ELSE
      left(p_key, 4) || repeat('*', greatest(length(p_key) - 8, 4)) || right(p_key, 4)
  END;
$$;

-- ─── 3. Coluna de chave mascarada para exibição no frontend ──────────────────
-- Gerada automaticamente — nunca armazena o valor real

ALTER TABLE cliente_integracoes
  ADD COLUMN IF NOT EXISTS api_key_masked text GENERATED ALWAYS AS (mascarar_api_key(api_key)) STORED;

-- ─── 4. RPC segura para admin buscar chave completa ──────────────────────────

CREATE OR REPLACE FUNCTION get_integracao_api_key(p_integracao_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_api_key    text;
  v_cliente_id uuid;
  v_papel      text;
BEGIN
  SELECT ci.api_key, ci.cliente_id
  INTO v_api_key, v_cliente_id
  FROM cliente_integracoes ci
  WHERE ci.id = p_integracao_id;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Integração não encontrada';
  END IF;

  SELECT LOWER(pu.papel::text) INTO v_papel
  FROM usuarios u
  JOIN papeis_usuarios pu ON pu.usuario_id = u.id
  WHERE u.auth_id = auth.uid() AND u.cliente_id = v_cliente_id
  LIMIT 1;

  IF v_papel IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acesso negado — apenas administradores podem visualizar a chave completa';
  END IF;

  RETURN v_api_key;
END;
$$;

REVOKE ALL ON FUNCTION get_integracao_api_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_integracao_api_key(uuid) TO authenticated;

-- ─── 5. Nota sobre criptografia em repouso ────────────────────────────────────
-- Para criptografia completa em repouso, usar pgsodium (Supabase Vault):
--   SELECT vault.create_secret('chave_esus_cliente_X', 'valor_da_key');
--   SELECT vault.decrypted_secret('chave_esus_cliente_X');
-- Implementação via pgsodium fica como melhoria futura.
-- O ganho imediato desta migration é: RLS restrita a admin + mascaramento.
