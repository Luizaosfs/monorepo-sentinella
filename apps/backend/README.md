# ms-api-sentinella — Backend

API REST do Sentinella Web.

**Stack:** NestJS 11 · Prisma 7.7.0 · PostgreSQL 17 + PostGIS 3.6.2 · TypeScript 5.7 · Zod 3.24

---

## Início rápido

```bash
cp .env.example .env      # preencher variáveis
pnpm install
pnpm generate             # gera Prisma Client
pnpm start:dev            # http://localhost:3333
```

Documentação:
- Swagger: `http://localhost:3333/api-docs`
- Scalar:  `http://localhost:3333/reference`

## Variáveis de ambiente

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/sentinella
SECRET_JWT=...
JWT_EXPIRES_IN=7d
PORT=3333
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ANTHROPIC_API_KEY=...
```

## Scripts

| Script | O que faz |
|---|---|
| `pnpm start:dev` | Watch mode |
| `pnpm build` | Compilar para dist/ |
| `pnpm generate` | Regenerar Prisma Client |
| `pnpm test` | Testes unitários |
| `pnpm lint` | ESLint |

---

## Módulos (29)

```
auth          billing       ciclo         cliente       cloudinary
cnes          dashboard     denuncia      drone         foco-risco
ia            imovel        import-log    job           levantamento
notificacao   operacao      piloto        planejamento  plano-acao
pluvio        quarteirao    regiao        reinspecao    risk-engine
seed          sla           usuario       vistoria
```

Cada módulo segue a estrutura:

```
{modulo}/
├── {modulo}.module.ts
├── {modulo}.controller.ts
├── entities/
├── repositories/          # interface abstrata
├── use-cases/             # lógica de negócio
├── dtos/                  # Zod schemas
├── view-model/
└── errors/
```

A implementação Prisma fica em:
```
src/shared/modules/database/prisma/
├── repositories/prisma-{modulo}.repository.ts
└── mappers/prisma-{modulo}.mapper.ts
```

## Fluxo de request

```
Request → AuthGuard → RolesGuard → TenantGuard
  → Controller (Zod parse) → UseCase
  → Repository (abstract) → PrismaRepository
  → Mapper.toDomain() → ViewModel.toHttp() → Response
```

---

## Autenticação

- Bearer token JWT (HS256, `SECRET_JWT`)
- Refresh tokens na tabela `refresh_tokens` (hash, expiração, revogação)
- Bridge: aceita tokens Supabase ES256 via JWKS durante migração

## Guards

| Guard | Responsabilidade |
|---|---|
| `auth.guard.ts` | Valida JWT Bearer (HS256 próprio + ES256 Supabase bridge) |
| `roles.guard.ts` | RBAC via `@Roles()` decorator |
| `tenant.guard.ts` | Injeta `request.tenantId` do JWT; admin override via `?clienteId=` |

## Papéis

`admin` · `supervisor` · `agente` (= `operador`) · `notificador` · `analista_regional`

> `platform_admin` não existe. Nunca criar.

---

## Schema Prisma

Split em arquivos por domínio em `prisma/schema/`.
PostGIS: `Unsupported("geometry(Polygon,4326)")` — `regioes.area` e `planejamento.area`.
Após qualquer alteração: `pnpm generate`.

## Cron Jobs (`@nestjs/schedule`)

| Service | Tarefas |
|---|---|
| `SlaSchedulerService` | Escalar, marcar vencidos, push crítico |
| `CnesSchedulerService` | Sync unidades de saúde (semanal) |
| `PluvioSchedulerService` | Risco pluvial (diário 6h) |
| `ReinspecaoSchedulerService` | Marcar reinspeções vencidas (diário 6h) |

## Analytics — sem views no banco

Todas as queries analíticas (dashboard, executivo, piloto, regional, eficácia, reincidência) são implementadas como Use Cases com `$queryRaw` inline — sem dependência de views PostgreSQL.

## Rate limiting

300 req/min por IP via `@nestjs/throttler`.
