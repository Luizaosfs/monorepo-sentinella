# Legacy — Supabase Era

Arquivos preservados da era Supabase (pré-migração para NestJS JWT + Cloudinary).
Migração concluída em 2026-04-20 (Fase 6 de 6).

## Conteúdo

| Arquivo/Pasta | Origem | Descrição |
|---|---|---|
| `schema-frontend-root.sql` | `apps/frontend/schema.sql` | Schema PostgreSQL era Supabase |
| `schema-supabase-folder.sql` | `apps/frontend/supabase/schema.sql` | Schema alternativo da pasta supabase/ |
| `rls-regras-supabase-era.md` | `apps/frontend/supabase/RLS-REGRAS.md` | Documentação das regras RLS |
| `supabase-migrations/` | `apps/frontend/supabase/migrations/` | ~200 migrations históricas |
| `supabase-scripts/` | `apps/frontend/supabase/scripts/` | Scripts utilitários da era Supabase |

## O que foi removido (não arquivado)

- `apps/frontend/supabase/functions/` — edge functions Deno (substituídas por NestJS services)
- `apps/frontend/supabase/config.toml` — config do Supabase CLI
- `apps/frontend/supabase/.temp/` — cache temporário
- `apps/frontend/supabase/functions/.env` — secrets (nunca arquivar)
- `apps/frontend/src/lib/supabase.ts` — client Supabase frontend (removido na Fase 4)
- `@supabase/supabase-js` — removido de `apps/frontend/package.json`

## Arquitetura atual

- Auth: JWT HS256 próprio (`SECRET_JWT`) + refresh tokens em `public.refresh_tokens`
- Storage: Cloudinary (via `CloudinaryService`)
- Edge functions: NestJS services + `@nestjs/schedule`
- RLS: Removido. Segurança via `AuthGuard` + `TenantGuard` no NestJS
