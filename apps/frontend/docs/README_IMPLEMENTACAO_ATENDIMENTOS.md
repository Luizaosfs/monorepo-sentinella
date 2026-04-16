# Implementação — Ciclo de Atendimento e Evidências

Migrações para fechar o ciclo: Coleta → Identificação → Operação (Atendimento) → Evidências e Encerramento de SLA.

## Ordem de execução (Supabase)

Execute no **SQL Editor** do Supabase (ou via `supabase db push`) na ordem:

| Ordem | Arquivo | Conteúdo |
|-------|---------|----------|
| 1 | `20250306100000_atendimentos_evidencias_tipo_entrada.sql` | Tabela `operacao_evidencias`, coluna `levantamentos.tipo_entrada` |
| 2 | `20250306110000_operacoes_trigger_concluido_sla.sql` | Constraint de status, trigger ao concluir operação + atualizar `sla_operacional` |
| 3 | `20250306120000_rls_operacoes_evidencias.sql` | RLS em `operacoes` e `operacao_evidencias`, função `current_usuario_public_id()` |
| 4 | `20250306130000_view_historico_atendimento_local.sql` | View `v_historico_atendimento_local` |

**Pré-requisito:** migrações anteriores de RLS já aplicadas (ex.: `20250302100000_rls_geral_todas_tabelas.sql`), pois as novas políticas usam `usuario_pode_acessar_cliente()`, `is_admin()` e `is_operador()`.

## Resumo do que foi criado

### 1. Atendimentos (evidências)
- **`operacao_evidencias`**: `id`, `operacao_id` (FK), `image_url`, `legenda`, `created_at`. Fotos "Antes/Depois" pelo operador.
- **`levantamentos.tipo_entrada`**: `text` para origem do levantamento (`'DRONE'` ou `'MANUAL'`). Enum `tipo_entrada_levantamento` criado opcionalmente.

### 2. Lógica de histórico e atendimento
- **`operacoes`**: constraint `operacoes_status_check` com valores `pendente`, `em_andamento`, `concluido`.
- **Trigger** `trg_operacoes_on_status_concluido`: ao atualizar `operacoes.status` para `'concluido'`:
  - preenche `concluido_em` com `now()` se estiver nulo;
  - atualiza `sla_operacional` (campos `concluido_em`, `status = 'concluido'`) quando a operação tem `item_operacional_id`.

### 3. Segurança (RLS)
- **`operacoes`**: SELECT/INSERT por `usuario_pode_acessar_cliente(cliente_id)`; UPDATE apenas admin ou quando `responsavel_id = current_usuario_public_id()` (operador responsável); DELETE por acesso ao cliente.
- **`operacao_evidencias`**: acesso via `operacoes` (só quem pode acessar a operação vê/insere/atualiza/remove evidências).
- **`current_usuario_public_id()`**: retorna `usuarios.id` do usuário autenticado (`auth.uid()` → `usuarios.auth_id`).

### 4. View de histórico geográfico
- **`v_historico_atendimento_local`**: junção de `levantamento_itens`, `levantamentos`, `operacoes` e `usuarios` (responsável). Filtra itens com `latitude` e `longitude` não nulos. Pensada para consultas por coordenada ao longo do tempo.
- View criada com `security_invoker = true` (PostgreSQL 15+) para que o RLS das tabelas base seja aplicado ao usuário que consulta.

## Uso no app

- **Evidências:** inserir em `operacao_evidencias` após upload da imagem (ex.: Storage + `image_url`). Só para operações que o usuário pode acessar (RLS já restringe).
- **Concluir operação:** `UPDATE operacoes SET status = 'concluido' WHERE id = ?`. O trigger preenche `concluido_em` e atualiza `sla_operacional` quando houver `item_operacional_id`.
- **Histórico por local:** `SELECT * FROM v_historico_atendimento_local WHERE latitude = ? AND longitude = ? ORDER BY item_data_hora DESC` (ou arredondar lat/lon para agrupar por célula).

## Bucket de evidências (Storage)

A UI do operador envia fotos para o bucket **`evidencias`**. No Supabase: **Storage → New bucket** → nome `evidencias`. Marque como **Public** se as imagens forem acessíveis por URL pública (recomendado para exibição no app). Configure políticas de Storage conforme necessário (ex.: apenas `authenticated` pode fazer upload).

## Observações

- **sla_operacional:** status usados na migração: `'pendente'`, `'em_atendimento'`, `'concluido'`. A função `gerar_slas_para_run` usa `'pendente'`; o trigger marca `'concluido'`.
- **tipo_entrada:** registros antigos em `levantamentos` podem ficar com `tipo_entrada` nulo; é opcional fazer `UPDATE ... SET tipo_entrada = 'DRONE' WHERE tipo_entrada IS NULL`.
