# CLAUDE.MD — MS-API-SENTINELLA

## VISÃO GERAL

Backend REST API do **Sentinella Web** — plataforma B2G SaaS de vigilância entomológica para municípios brasileiros no combate ao Aedes aegypti (dengue/chikungunya/zika).

**Stack:** NestJS 11 · Prisma 7.7.0 · Zod 3.24 · JWT · PostgreSQL 17 · PostGIS 3.6.2
**Arquitetura:** SOLID com Use Cases — Controller → UseCase → Repository → Mapper → ViewModel

---

## CONTEXTO DA MIGRAÇÃO

Este projeto é uma **migração do Supabase** para backend NestJS próprio.

### O que existia antes (Supabase)
- PostgreSQL com RLS (490+ policies), 185 triggers, 538 functions
- Frontend React com `supabase.from()`, `.rpc()`, edge functions Deno
- Auth via Supabase Auth

### O que mudou
- Auth: Supabase Auth → JWT próprio (HS256) + refresh tokens na tabela `refresh_tokens`
- Queries: `supabase.from()` → REST endpoints NestJS via `@sentinella/api-client`
- RPCs: `supabase.rpc()` → Use Cases NestJS
- Edge Functions: Deno → NestJS services + `@nestjs/schedule`
- RLS: Removido. Segurança via AuthGuard + TenantGuard
- Views analíticas: **Sem views no banco.** Toda analytics é Use Case com `$queryRaw` inline

### O que NÃO mudou
- Banco PostgreSQL (schema, tabelas, triggers de auditoria, PostGIS)
- Frontend React (visual idêntico)

---

## ARQUITETURA SOLID — PADRÃO OBRIGATÓRIO

```
src/modules/{nome}/
├── {nome}.module.ts
├── {nome}.controller.ts        # REST endpoints (thin layer)
├── entities/{nome}.ts          # Domain entity (extends BaseEntity)
├── repositories/{nome}.ts      # Abstract repository (interface)
├── use-cases/                  # Um arquivo por caso de uso
│   └── test/                   # Testes unitários por use case
├── dtos/                       # Zod schema + createZodDto
├── view-model/{nome}.ts        # ViewModel.toHttp() — sanitiza saída
└── errors/{nome}.exception.ts  # createExceptionFactory()
```

Implementação Prisma em:
```
src/shared/modules/database/prisma/
├── repositories/prisma-{nome}.repository.ts   # @PrismaRepository decorator
└── mappers/prisma-{nome}.mapper.ts            # toDomain() + toPrisma()
```

### Fluxo de request
```
Request → AuthGuard → RolesGuard → TenantGuard
  → Controller (Zod parse) → UseCase (regra de negócio)
  → Repository (abstract) → PrismaRepository (implementação)
  → Mapper.toDomain() / toPrisma()
  → ViewModel.toHttp() → Response
```

---

## MÓDULOS (29)

```
auth          billing       ciclo         cliente       cloudinary
cnes          dashboard     denuncia      drone         foco-risco
ia            imovel        import-log    job           levantamento
notificacao   operacao      piloto        planejamento  plano-acao
pluvio        quarteirao    regiao        reinspecao    risk-engine
seed          sla           usuario       vistoria
```

---

## REGRAS IMUTÁVEIS

### Papéis (NUNCA alterar)
- `admin` — operador da plataforma SaaS, sem cliente_id, acesso total
- `supervisor` — gestor municipal
- `agente` — agente de campo (= `operador`; rotas `/agente/*` e `/operador/*` são do mesmo papel)
- `notificador` — funcionário UBS
- `analista_regional` — analista multi-municípios

**`platform_admin` NÃO existe. Nunca criar.**

### Multitenancy
- Isolamento via `cliente_id` (UUID) em WHERE — não via schema separado
- `TenantGuard` injeta `request['tenantId']` do JWT
- Admin sem `cliente_id` seleciona tenant via `?clienteId=xxx`
- Todo repository de tenant DEVE filtrar por `cliente_id`

### Máquina de estados — focos_risco
```
suspeita → em_triagem → aguarda_inspecao → em_inspecao → confirmado → em_tratamento → resolvido
         ↘           ↘                  ↘             ↘            ↘              ↘ descartado
```

Transições válidas:
- `suspeita` → `em_triagem`
- `em_triagem` → `aguarda_inspecao` | `descartado`
- `aguarda_inspecao` → `em_inspecao` | `descartado`
- `em_inspecao` → `confirmado` | `descartado`
- `confirmado` → `em_tratamento`
- `em_tratamento` → `resolvido` | `descartado`

Toda transição DEVE gerar registro em `foco_risco_historico` (append-only).
`resolvido` e `descartado` são terminais — não reabre; cria novo foco com `foco_anterior_id`.

### SLA
- Prazo canônico: `sla_operacional.prazo_final` (banco)
- SLA inicia quando foco transiciona para `confirmado`
- Configurável por cliente e por região (`sla_config`, `sla_config_regiao`)

### PostGIS
- `regioes.area` — `geometry(Polygon,4326)` — populado automaticamente pelo `PrismaRegiaoWriteRepository` a partir do campo `geojson` via `ST_GeomFromGeoJSON()`
- `planejamento.area` — `geometry(Polygon,4326)`
- Índices GIST em ambas as colunas para `ST_Contains` no despacho de agentes

### Analytics — sem views no banco
Toda query analítica (dashboard executivo, piloto, regional, eficácia, reincidência) é implementada como Use Case com `$queryRaw` inline. **Nunca criar views PostgreSQL** para analytics.

---

## PADRÕES DE CÓDIGO

### Controller
```typescript
@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Nome')
@Controller('rota')
export class NomeController {
  constructor(private createNome: CreateNome) {}

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar' })
  async create(@Body() body: CreateNomeBody) {
    const parsed = createNomeSchema.parse(body);
    const { item } = await this.createNome.execute(parsed);
    return NomeViewModel.toHttp(item);
  }
}
```

### Use Case com $queryRaw (analytics)
```typescript
@Injectable()
export class GetNomeAnalytics {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM nome_tabela
      WHERE cliente_id = ${clienteId}::uuid
        AND deleted_at IS NULL
    `);
  }
}
```

### DTO com Zod
```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createNomeSchema = z.object({
  campo: z.string({ required_error: 'Campo obrigatório' }),
  clienteId: z.string().uuid().optional(),
});

export class CreateNomeBody extends createZodDto(createNomeSchema) {}
```

### Exception
```typescript
import { createExceptionFactory } from '@/common/errors/exception-factory';

export const NomeException = createExceptionFactory({
  notFound:      { type: 'notFound',  message: 'Registro não encontrado' },
  alreadyExists: { type: 'conflict',  message: 'Registro já existe' },
});
```

---

## AUTENTICAÇÃO

- Bearer token JWT (HS256, `SECRET_JWT`)
- Refresh tokens na tabela `refresh_tokens` (token_hash, expires_at, revoked_at, used_at)
- Bridge: aceita tokens Supabase ES256 via JWKS durante migração
- `@Public()` decorator libera rotas sem autenticação

---

## IDs E TIPOS

- UUIDs em todos os IDs: `@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`
- BigInt de `COUNT(*)` é serializado via `BigInt.prototype.toJSON = () => Number(this)` em `main.ts`

---

## SCHEMA PRISMA

Split em arquivos por domínio em `prisma/schema/`.
Tipos PostGIS: `Unsupported("geometry(Polygon,4326)")`.
Após qualquer alteração: `pnpm generate`.

---

## CRON JOBS (`@nestjs/schedule`)

| Service | Frequência | Responsabilidade |
|---|---|---|
| `SlaSchedulerService` | Múltiplas | Escalar focos, marcar SLAs vencidos, push crítico |
| `CnesSchedulerService` | Semanal | Sync unidades de saúde (CNES) |
| `PluvioSchedulerService` | Diário 6h | Cálculo de risco pluvial |
| `ReinspecaoSchedulerService` | Diário 6h | Marcar reinspeções vencidas |

---

## REGRAS ESPECÍFICAS POR MÓDULO

### foco-risco
- Toda transição de status gera registro em `foco_risco_historico`
- `score_prioridade` calculado pelo trigger `trg_recalcular_score_prioridade` — não atualizar manualmente
- Colunas REMOVIDAS de `levantamento_itens` (migration 20260711): `status_atendimento`, `acao_aplicada`, `data_resolucao` — não referenciar

### reinspecao
- Foco entra em `em_tratamento` → trigger cria reinspeção pendente (7 dias)
- Foco resolvido/descartado → trigger cancela reinspeções pendentes
- Máx. 1 reinspeção pendente por `(foco_risco_id, tipo)`

### regiao
- `area geometry(Polygon,4326)` populada via `ST_GeomFromGeoJSON(geojson::text)` no `PrismaRegiaoWriteRepository.syncArea()`
- `ST_Contains(regioes.area, ponto)` usado no despacho para inferir `regiao_id` automaticamente

### sla
- `sla_foco_config` define prazos por fase
- `sla_config_regiao` sobrepõe config geral por região
- Feriados via `sla_feriados` (por cliente)

### ia
- Cache `ia_insights` verificado antes de chamar Claude Haiku
- `force_refresh=true` no body ignora cache

### cnes
- `uf` + `ibge_municipio` no cliente são obrigatórios para sync
- Unidades com `origem='manual'` e `cnes IS NULL` nunca são inativadas
- Inativação: `ativo=false`, nunca DELETE

### denuncia
- `POST /denuncia/cidadao` é público (`@Public()`)
- Rate limit: `canal_cidadao_rate_limit` (10/hora por IP por cliente)
- Retorna `{ ok, foco_id, deduplicado }`; protocolo = primeiros 8 chars do `foco_id`

---

## SEGURANÇA — NÃO REVERTER

- `platform_admin` é valor morto — nenhum usuário deve tê-lo
- IDOR cross-tenant: `findById` sempre filtra por `cliente_id` quando `clienteId != null`
- `denunciar_cidadao` cria `foco_risco` diretamente com rate limit
- Sem RLS no banco — toda segurança é NestJS guards

---

## VARIÁVEIS DE AMBIENTE

```env
DATABASE_URL=postgresql://...
SECRET_JWT=...
JWT_EXPIRES_IN=7d
PORT=3333
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ANTHROPIC_API_KEY=...
```

---

## COMO INICIAR

```bash
pnpm install
cp .env.example .env
pnpm generate        # gera Prisma client
pnpm start:dev       # porta 3333
# Swagger: http://localhost:3333/api-docs
# Scalar:  http://localhost:3333/reference
```
