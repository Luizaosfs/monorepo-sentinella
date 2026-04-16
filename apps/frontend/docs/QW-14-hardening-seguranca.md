# QW-14 — Hardening de Segurança

**Status:** Planejamento
**Data:** 2026-03-26
**Escopo:** Auditoria técnica e endurecimento incremental de segurança

---

## 1. Pontos Fortes Atuais

### 1.1 Autenticação e multitenancy
- RLS habilitado em todas as tabelas do domínio operacional
- Toda query filtra `cliente_id` — multitenancy estrutural
- `useClienteAtivo()` centraliza obtenção do tenant em componentes
- Rotas protegidas por `AdminGuard`, `AdminOrSupervisorGuard`, `OperadorGuard`
- Supabase Auth com JWT — expiração gerenciada pelo Supabase

### 1.2 Canal cidadão
- `DenunciaCidadao.tsx` acessa via RPC `SECURITY DEFINER` — não expõe dados de outros clientes
- Rota `/denuncia/:slug/:bairroId` sem auth — escopo restrito pelo slug

### 1.3 LGPD
- `casos_notificados` não armazena nome, CPF ou data de nascimento
- Soft delete implementado (QW-10A) — rastreabilidade preservada
- Logs de retenção com purga programada (QW-10C)

### 1.4 Edge Functions
- `verify_jwt = true` configurado na maioria das funções sensíveis
- `health-check` e funções de cron têm `verify_jwt = false` com justificativa
- Secrets injetados via variáveis de ambiente no Supabase (não expostos no frontend)

---

## 2. Fragilidades Encontradas

### 2.1 Superfície de Ataque — Classificação

| Ponto de Exposição | Risco | Tipo |
|---|---|---|
| `health-check` Edge Function | MÉDIO | verify_jwt=false, sem rate limit |
| Canal cidadão `/denuncia` | MÉDIO | público, sem throttle por IP |
| RPC `canal_cidadao_denunciar` | MÉDIO | SECURITY DEFINER sem rate limit |
| Upload de evidência Cloudinary | ALTO | sem validação MIME no backend |
| Push subscription endpoint | BAIXO | sem deduplicação agressiva |
| Notificação e-SUS Notifica | MÉDIO | API key no Supabase secrets, mas payload logado |
| Login `/auth/login` | MÉDIO | sem lockout explícito no frontend |
| Relatório semanal (Resend) | BAIXO | triggered por cron interno |
| `job-worker` Edge Function | MÉDIO | sem isolamento de tenant no worker |
| Funções de sync CNES | MÉDIO | percorre todos os clientes — starvation possível |

### 2.2 Autenticação e Autorização

**Problema real:**
- Não há verificação explícita de expiração de sessão no frontend — token pode estar stale após longa ausência do operador
- `AdminPainelMunicipios.tsx` acessa dados de múltiplos clientes — requer papel de "admin plataforma", mas não há papel específico para isso no RBAC atual
- Algumas Edge Functions usam `service_role` internamente sem log de auditoria da chamada

**Risco potencial:**
- Elevação de privilégio via manipulação de claims JWT customizados — depende de como os papéis estão armazenados
- Se papel está em tabela `usuarios` (não em claims JWT), um atacante com acesso ao banco pode alterar papel sem invalidar JWT

**Verificar:**
```sql
-- Verificar se papel está em JWT claims ou só na tabela
SELECT auth_id, papel FROM usuarios LIMIT 5;
-- Se papel não está em app_metadata do JWT, há risco de cache de autorização stale
```

### 2.3 Secrets e Credenciais

**Problema real:**
- `CLOUDINARY_API_SECRET` e `RESEND_API_KEY` — corretos no Supabase Secrets, mas se Edge Function logar request/response por acidente, vaza em logs da Edge Function
- `ESUS_API_KEY` armazenada em `cliente_integracoes` no banco — RLS protege, mas é texto plano; idealmente deveria ser criptografada com `pgp_sym_encrypt`

**Risco potencial:**
- Console.log ou Deno.env.get() logado em Edge Functions de debug não deve ir para produção
- Erro detalhado de integração e-SUS pode vazar URL e token nos logs visíveis ao admin

**Ação mínima recomendada:**
- Auditar todos os `console.log` em Edge Functions — remover logs que incluam tokens, keys ou payloads sensíveis
- Criptografar `api_key` em `cliente_integracoes` com `pgcrypto`

### 2.4 Upload e Arquivos

**Problema real:**
- `cloudinary-upload-image` Edge Function — não valida tipo MIME nem extensão no backend antes de enviar ao Cloudinary
- Cloudinary aceita qualquer arquivo se credentials forem válidas — risco de upload de executável ou SVG com XSS
- Sem limite de tamanho explícito na Edge Function (Cloudinary tem limite de 10MB por default, mas não é verificado antes do upload)

**Ações recomendadas:**
```typescript
// Na Edge Function cloudinary-upload-image
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

if (!ALLOWED_MIME.includes(contentType)) {
  return new Response('Tipo de arquivo não permitido', { status: 415 });
}
if (body.byteLength > MAX_SIZE_BYTES) {
  return new Response('Arquivo muito grande', { status: 413 });
}
```

### 2.5 Rate Limiting e Abuso

**Ausência de proteção em:**

| Endpoint | Risco | Ação |
|---|---|---|
| Canal cidadão (por IP) | ALTO | Denúncias de spam saturariam banco |
| `health-check` público | MÉDIO | Pode ser usado para fingerprinting |
| Login (frontend) | MÉDIO | Supabase tem throttle básico, verificar config |
| Upload de evidência | MÉDIO | Sem limite por sessão/dia |
| Triagem IA (`triagem-ia-pos-voo`) | ALTO | Chamadas Claude Haiku custam dinheiro |
| Relatório manual trigger | MÉDIO | Admin pode disparar múltiplos relatórios |
| `job-worker` retry | MÉDIO | Loop de retry sem backoff pode causar spam |

**Implementação mínima recomendada — canal cidadão:**
```sql
-- Tabela de rate limit por IP
CREATE TABLE canal_cidadao_rate_limit (
  ip_hash text NOT NULL,
  cliente_id uuid NOT NULL,
  janela_hora timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  contagem int NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_hash, cliente_id, janela_hora)
);

-- Na RPC canal_cidadao_denunciar: verificar se ip_hash já tem >= 10 registros na janela atual
```

### 2.6 Banco e RLS

**Verificar obrigatoriamente:**

```sql
-- 1. Listar todas as funções SECURITY DEFINER (podem contornar RLS)
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND security_type = 'DEFINER';

-- 2. Tabelas sem RLS habilitado
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT relname FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  AND relrowsecurity = true
);

-- 3. Views com dados sensíveis sem security_invoker
SELECT viewname FROM pg_views
WHERE schemaname = 'public';
```

**Riscos identificados:**
- `v_imovel_historico_acesso` — view de leitura, verificar se tem `WITH (security_invoker = true)` ou depende de RLS subjacente
- `resumo_agente_ciclo` RPC — retorna dados do agente, verificar se filtra por `cliente_id` antes de retornar
- `listar_casos_no_raio` RPC — retorna casos geoespacialmente; verificar isolamento de tenant
- `trg_cruzar_caso_focos` trigger — lê `levantamento_itens` para cruzamento; verificar que só acessa dados do mesmo cliente

**Dados sensíveis em logs:**
- `sistema_logs` e `job_queue` — verificar se payloads completos de jobs são logados (podem conter coordenadas GPS reais de moradores)

### 2.7 Observabilidade de Segurança

**O que está faltando:**
- Sem log de tentativas de acesso a rotas admin por usuário sem permissão
- Sem alerta para múltiplas falhas de autenticação do mesmo IP/usuário
- Sem log de exclusões (soft delete registra `deleted_at`, mas não registra QUEM excluiu)
- Sem detecção de anomalia em uploads (volume anormal por cliente)
- Sem auditoria de quem invocou uma Edge Function manualmente

**Proposta mínima — auditoria de ações críticas:**
```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes(id),
  usuario_id uuid,
  acao text NOT NULL,          -- 'DELETE', 'EXPORT', 'FORCE_SYNC', etc.
  tabela text,
  registro_id uuid,
  ip_hash text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- Apenas admins lêem; sistema escreve via service_role
```

---

## 3. Classificação de Risco

| Item | Risco | Impacto | Probabilidade |
|---|---|---|---|
| Upload sem validação MIME | ALTO | Injeção de arquivo malicioso | Média |
| Rate limit canal cidadão | ALTO | Spam / custo de banco | Alta |
| Rate limit triagem IA | ALTO | Custo Claude Haiku descontrolado | Média |
| `api_key` e-SUS em texto plano | MÉDIO | Vazamento se dump do banco | Baixa |
| Papéis não em JWT claims | MÉDIO | Cache de autorização stale | Baixa |
| Logs com dados sensíveis | MÉDIO | Vazamento de payload em Edge logs | Média |
| Funções SECURITY DEFINER sem revisão | MÉDIO | Bypass de RLS não intencional | Baixa |
| health-check fingerprinting | BAIXO | Enumeração de versão/infra | Baixa |
| Sessão stale no frontend | BAIXO | Acesso por dispositivo compartilhado | Média |

---

## 4. Proposta de Correções Incrementais

### Sprint A — Correções Críticas (1–2 dias)

**A1. Validação MIME/tamanho na Edge Function de upload**
- Arquivo: `supabase/functions/cloudinary-upload-image/index.ts` e `upload-evidencia/index.ts`
- Validar `Content-Type` e `Content-Length` antes de qualquer chamada ao Cloudinary
- Lista branca: `image/jpeg`, `image/png`, `image/webp`

**A2. Rate limit no canal cidadão**
- Adicionar verificação de frequência por IP na RPC `canal_cidadao_denunciar`
- Limite sugerido: 10 denúncias por IP por hora por cliente
- Implementar com tabela `canal_cidadao_rate_limit` (TTL 24h)

**A3. Rate limit na triagem IA**
- `triagem-ia-pos-voo` deve verificar se levantamento já foi processado antes de chamar Claude
- Adicionar campo `triagem_solicitada_em` em `levantamentos` — não reprocessar se < 30min

### Sprint B — Proteções de Médio Prazo (3–5 dias)

**B1. Auditar e sanitizar logs das Edge Functions**
- Remover todo `console.log` que inclua tokens, API keys, ou dados de integração
- Substituir por logs estruturados sem dados sensíveis: `console.log('[cnes-sync] cliente processado', cliente_id)`

**B2. Criptografia de `api_key` em `cliente_integracoes`**
```sql
-- Requer extensão pgcrypto
ALTER TABLE cliente_integracoes
  ADD COLUMN api_key_enc bytea;

-- Migration de dados existentes (usar chave via Vault ou Supabase Secret)
UPDATE cliente_integracoes
  SET api_key_enc = pgp_sym_encrypt(api_key, current_setting('app.encryption_key'))
  WHERE api_key IS NOT NULL;

ALTER TABLE cliente_integracoes DROP COLUMN api_key;
```

**B3. Revisão de todas as RPCs SECURITY DEFINER**
- Listar e documentar cada função
- Garantir que todas filtram `cliente_id` explicitamente
- Adicionar comentário SQL: `-- SECURITY DEFINER: justificativa aqui`

**B4. Tabela `audit_log` para ações críticas**
- Criar tabela conforme proposta acima
- Registrar: exclusões de usuário, alterações de papel, force-sync CNES, geração de relatório, exportação CSV

### Sprint C — Observabilidade de Segurança (2–3 dias)

**C1. Dashboard de segurança no AdminSaudeSistema**
- Tentativas de acesso negado (403 em rotas guard)
- Uploads recentes por cliente (detectar anomalia)
- Jobs com falha repetida
- RPCs mais chamadas (detectar uso anormal)

**C2. Alertas de anomalia**
- Se canal cidadão recebe > 50 denúncias em 1h de um IP: log + alerta para admin
- Se triagem IA é chamada > 3x pelo mesmo levantamento: bloquear e notificar

---

## 5. Impacto por Camada

| Camada | Impacto | Esforço |
|---|---|---|
| Edge Functions (upload, canal, triagem) | Médio — validação e rate limit | 1–2 dias |
| Banco — criptografia api_key | Baixo — migration simples | 0,5 dia |
| Banco — audit_log | Baixo — nova tabela | 0,5 dia |
| Banco — revisão SECURITY DEFINER | Baixo — apenas leitura e documentação | 1 dia |
| Frontend — sem impacto imediato | — | — |

---

## 6. Distinção de Problemas

### Problema real (corrigir agora)
- Upload sem validação MIME
- Rate limit canal cidadão
- Rate limit triagem IA (custo direto)
- Logs com dados sensíveis em Edge Functions

### Risco potencial (mitigar no Sprint B)
- `api_key` e-SUS em texto plano
- Funções SECURITY DEFINER sem revisão documentada
- Sessão JWT stale no frontend (operador campo fica horas sem reconectar)

### Melhoria futura (não urgente)
- Criptografia end-to-end de evidências no Cloudinary
- Assinatura de URL com expiração para acesso a imagens
- 2FA para perfil admin
- Integração com SIEM/WAF externo
- Testes automatizados de RLS (QW previsto no grupo 5)

---

## 7. Ordem de Execução Recomendada

```
Sprint A (prioridade 1):
  A1 → validação MIME upload
  A2 → rate limit canal cidadão
  A3 → idempotência triagem IA

Sprint B (prioridade 2):
  B1 → sanitizar logs Edge Functions
  B2 → criptografar api_key integração
  B3 → documentar SECURITY DEFINER
  B4 → criar audit_log

Sprint C (prioridade 3):
  C1 → dashboard segurança
  C2 → alertas anomalia
```

---

## 8. Checklist de Auditoria SQL (executar antes de implementar)

```sql
-- 1. Tabelas sem RLS
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND NOT EXISTS (
  SELECT 1 FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = tablename AND c.relrowsecurity = true
);

-- 2. Funções SECURITY DEFINER
SELECT p.proname, p.prosecdef, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef = true;

-- 3. Políticas RLS sem filtro cliente_id
SELECT schemaname, tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
AND qual NOT LIKE '%cliente_id%'
AND tablename NOT IN ('canal_cidadao_rate_limit', 'audit_log');

-- 4. Verificar api_key exposta
SELECT id, cliente_id, length(api_key) as len_key
FROM cliente_integracoes
WHERE api_key IS NOT NULL;
```
