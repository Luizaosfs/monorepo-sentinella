# MIGRATION_OPS — Runbook operacional da migração Supabase → NestJS

> **Audiência**: engenheiro responsável pelo deploy em staging/produção.  
> **Pré-requisito**: acesso ao banco PostgreSQL e ao painel de variáveis de ambiente.

---

## 1. Backfill de `senha_hash` em produção

### O problema

Usuários criados antes da migração têm `usuarios.senha_hash = NULL`.  
Os use-cases `login`, `change-password` e `reset-password` já usam essa coluna.  
Usuários legados que nunca resetaram a senha **não conseguem fazer login pelo NestJS** — eles dependem da bridge Supabase ainda ativa no `AuthGuard`.

### Pré-checklist

- [ ] Backup de `auth.users` exportado para S3 ou armazenamento local:
  ```bash
  pg_dump $DATABASE_URL -t auth.users -Fc -f auth_users_backup_$(date +%Y%m%d).dump
  ```
- [ ] Confirmar que o `AuthGuard` bridge ainda está ativo (`SUPABASE_JWT_SECRET` definida).
- [ ] Rodar o script de auditoria para saber o volume:
  ```bash
  node apps/backend/scripts/check-senha-hash-status.mjs
  ```
  Anotar `legados_pendentes` antes da execução.

### Query de contagem — antes

```sql
SELECT
  COUNT(*) FILTER (WHERE auth_id IS NOT NULL AND senha_hash IS NULL) AS legados_pendentes
FROM public.usuarios;
```

### Execução do backfill

O backfill copia o `encrypted_password` do Supabase Auth para `usuarios.senha_hash`.  
Os hashes já são bcrypt — não é necessário re-hash.

```sql
-- backfill_senha_hash.sql
UPDATE public.usuarios u
SET
  senha_hash = a.encrypted_password,
  updated_at = NOW()
FROM auth.users a
WHERE u.auth_id = a.id
  AND u.senha_hash IS NULL
  AND a.encrypted_password IS NOT NULL;
```

Execute em transação para poder reverter:

```sql
BEGIN;

UPDATE public.usuarios u
SET
  senha_hash = a.encrypted_password,
  updated_at = NOW()
FROM auth.users a
WHERE u.auth_id = a.id
  AND u.senha_hash IS NULL
  AND a.encrypted_password IS NOT NULL;

-- Conferir antes de commitar:
SELECT COUNT(*) FILTER (WHERE auth_id IS NOT NULL AND senha_hash IS NULL) AS ainda_pendentes
FROM public.usuarios;

-- Se ainda_pendentes = 0, commitar. Caso contrário, ROLLBACK e investigar.
COMMIT;
```

### Query de contagem — depois

```bash
node apps/backend/scripts/check-senha-hash-status.mjs
# Deve imprimir: ✅ Migração de senha_hash completa.
# E retornar exit code 0.
```

### Critério de sucesso

`legados_pendentes = 0` no script de auditoria.

---

## 2. Ligar `CANAL_CIDADAO_V2_ENABLED`

### O que muda

V2 implementa rate limiting por IP (5 req/30 min), deduplicação geográfica via PostGIS (30 m) e persistência em `canal_cidadao_rate_log`. V1 delegava tudo para RPC SQL.

### Passo 1 — staging com tráfego sintético

```bash
# Ajuste a URL conforme seu ambiente de staging
BASE=https://staging-api.sentinella.app

# Request válida (com coordenadas)
curl -s -X POST "$BASE/denuncia/cidadao" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "poco_destampado",
    "latitude": -23.5505,
    "longitude": -46.6333,
    "descricao": "Teste sintético v2",
    "municipio_ibge": "3550308"
  }' | jq .

# Simular rate limit: executar o mesmo curl 6 vezes rapidamente
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "req $i → HTTP %{http_code}\n" \
    -X POST "$BASE/denuncia/cidadao" \
    -H "Content-Type: application/json" \
    -d '{"tipo":"poco_destampado","latitude":-23.5505,"longitude":-46.6333,"municipio_ibge":"3550308"}'
done
# Esperado: primeiras 5 retornam 201, a 6ª retorna 429
```

Verificar em `canal_cidadao_rate_log` que os registros foram criados.

### Passo 2 — ligar em staging

```env
CANAL_CIDADAO_V2_ENABLED=true
```

Reiniciar o serviço e monitorar logs por 24 h. Verificar ausência de erros 500.

### Passo 3 — município piloto em produção

Sugestão: o município com **menor volume** de denúncias (menor risco de impacto).  
Ligar `CANAL_CIDADAO_V2_ENABLED=true` apenas nessa instância (se deploy por tenant) ou para todos após validação em staging.

### Monitoramento pós-ativação (7 dias)

```sql
-- Taxa de erros por dia (deve ser 0)
SELECT
  DATE(created_at) AS dia,
  motivo,
  COUNT(*) AS total
FROM canal_cidadao_rate_log
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;
```

### Critério de rollback

Se **> 5 %** dos requests retornarem 500, ou se houver protocolo duplicado (`deduplicado = false` para coordenadas idênticas):

```env
CANAL_CIDADAO_V2_ENABLED=false
```

Reiniciar o serviço. Abrir issue com logs do período.

---

## 3. Remover a bridge Supabase do `AuthGuard`

### Pré-condição

Zero ocorrências de `auth.jwt.supabase_hs256` ou `auth.jwt.supabase_es256` nos logs por **30 dias consecutivos**.

Verificar com:

```bash
# Em produção, filtrar os logs pelo evento
grep '"event":"auth.jwt.supabase_' /var/log/sentinella/app.log | wc -l
# Deve retornar 0
```

Também verificar via `GET /admin/migration-health`:
```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.sentinella.app/admin/migration-health | jq .
# supabase_bridge_ativa deve ser true (enquanto não removida)
# Após remoção das env vars, será false
```

### Alterações no código

1. Em `src/guards/auth.guard.ts`, remover:
   - A importação de `crypto` (se não usada em outro lugar)
   - O método `getSupabasePublicKey`
   - O campo `jwksCache`
   - O bloco `catch (nestErr) { ... }` inteiro (o `try` passa a ter apenas `throw` em caso de erro)
   - As variáveis `tokenSource`, `bridgeKid`, `t0` do fallback (manter o log do NestJS JWT)

2. Remover as env vars do `.env` de produção:
   ```
   SUPABASE_URL=
   SUPABASE_JWT_SECRET=
   SUPABASE_ANON_KEY=
   ```

3. Remover do `src/lib/env/server.ts` os campos:
   - `SUPABASE_JWT_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

### Validação

```bash
pnpm --filter @sentinella/backend test        # specs devem passar
pnpm --filter @sentinella/backend build       # build sem erros TS
```

Deploy em staging → testar login com token NestJS real → verificar que token Supabase retorna 401.

---

## Referência rápida

| Endpoint | Proteção | Uso |
|---|---|---|
| `GET /health` | público | liveness/readiness (load balancer) |
| `GET /admin/migration-health` | `admin` JWT | estado da migração em tempo real |

| Script | Saída |
|---|---|
| `node scripts/check-senha-hash-status.mjs` | tabela + exit code 0/1 |
