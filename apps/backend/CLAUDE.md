# CLAUDE.MD — MS-API-SENTINELLA

## VISÃO GERAL

Backend REST API do **Sentinella Web** — plataforma B2G SaaS de vigilância entomológica para municípios brasileiros no combate ao Aedes aegypti (dengue/chikungunya/zika).

**Stack**: NestJS 11 + Prisma 6 + Zod + JWT + PostgreSQL 17 + PostGIS
**Arquitetura**: SOLID com Use Cases, seguindo o padrão do ManFrota Finance como referência.

---

## CONTEXTO DA MIGRAÇÃO

Este projeto é uma **migração do Supabase** para backend próprio NestJS.

### O que existia antes (Supabase)
- 190 tabelas PostgreSQL com 491 RLS policies, 185 triggers, 538 functions
- Frontend React 18 com 366 chamadas `supabase.from()`, 48 `.rpc()`, 7 edge function invocations
- Autenticação via Supabase Auth (email/password)
- 23 Edge Functions em Deno (jobs, integrações, uploads)

### O que muda
- Auth: Supabase Auth → JWT próprio (Bearer token)
- Queries: `supabase.from().select()` → REST endpoints NestJS
- RPCs: `supabase.rpc()` → Use Cases no NestJS
- Edge Functions: Deno → NestJS services + @nestjs/schedule ou BullMQ
- RLS: Removido. Segurança passa para AuthGuard + TenantGuard no backend
- DB: **Mesmo banco PostgreSQL**. Tabelas, triggers de auditoria e PostGIS permanecem

### O que NÃO muda
- Frontend React permanece 100% igual visualmente
- Banco de dados (schema, tabelas, dados)
- Triggers de auditoria

---

## ARQUITETURA SOLID — PADRÃO OBRIGATÓRIO

Cada módulo segue esta estrutura (idêntica ao ManFrota Finance):

```
src/modules/{nome}/
├── {nome}.module.ts          # NestJS module
├── {nome}.controller.ts      # REST endpoints (thin layer)
├── entities/
│   └── {nome}.ts             # Domain entity (extends BaseEntity)
├── repositories/
│   └── {nome}.ts             # Abstract repository (interface)
├── use-cases/
│   ├── create-{nome}.ts      # Um arquivo por caso de uso
│   ├── filter-{nome}.ts
│   ├── pagination-{nome}.ts
│   ├── save-{nome}.ts
│   ├── delete-{nome}.ts
│   └── test/                 # Testes unitários por use case
├── dtos/
│   ├── create-{nome}.body.ts # Zod schema + createZodDto
│   ├── save-{nome}.body.ts
│   └── filter-{nome}.input.ts
├── view-model/
│   └── {nome}.ts             # ViewModel.toHttp() — sanitiza saída
└── errors/
    └── {nome}.exception.ts   # createExceptionFactory()
```

A implementação do repositório fica em:
```
src/shared/modules/database/prisma/
├── repositories/prisma-{nome}.repository.ts  # @PrismaRepository decorator
└── mappers/prisma-{nome}.mapper.ts           # toDomain() + toPrisma()
```

### Fluxo de uma request
```
Request → AuthGuard → RolesGuard → TenantGuard
  → Controller (parse Zod) → UseCase (regra de negócio)
  → Repository (abstract) → PrismaRepository (implementação)
  → Mapper.toDomain() / toPrisma()
  → ViewModel.toHttp() → Response
```

---

## REGRAS IMUTÁVEIS

### Papéis (NUNCA alterar)
Três papéis principais + 2 auxiliares. **agente e operador são o MESMO papel**:
- `admin` — operador da plataforma SaaS, sem cliente_id, acesso total
- `supervisor` — gestor municipal, portal /gestor/*
- `agente` — operador de campo (exibido como "Agente de Endemias" na UI). Rotas `/agente/*` e `/operador/*` pertencem a este papel
- `notificador` — funcionário UBS, portal /notificador/*
- `analista_regional` — analista que vê dados de múltiplos municípios

**`platform_admin` NÃO existe. Nunca criar.**

### Multitenancy
- Isolamento via `cliente_id` (UUID) em WHERE, NÃO via schema separado
- O TenantGuard injeta `request['tenantId']` a partir do JWT
- Todo repository que acessa dados de tenant DEVE filtrar por cliente_id
- Admin pode acessar qualquer tenant via `?clienteId=xxx`

### Máquina de estados do foco_risco
Estados: `suspeita → em_triagem → aguarda_inspecao → em_inspecao → confirmado → em_tratamento → resolvido|descartado`

**Transições válidas** (implementar como UseCase, não como RPC):
- suspeita → em_triagem
- em_triagem → aguarda_inspecao | descartado
- aguarda_inspecao → em_inspecao | descartado
- em_inspecao → confirmado | descartado
- confirmado → em_tratamento
- em_tratamento → resolvido | descartado

Toda transição DEVE gerar registro em `foco_risco_historico`.

### SLA
- Prazo canônico está em `sla_operacional.prazo_final` (banco)
- Frontend `SLA_RULES` é `@deprecated` — não usar como fonte de verdade

---

## PADRÕES DE CÓDIGO

### Controller
```typescript
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Nome')
@Controller('rota')
export class NomeController {
  constructor(
    private createNome: CreateNome,
    private filterNome: FilterNome,
    private paginationNome: PaginationNome,
  ) {}

  @Get()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar' })
  async filter(@Query() filters: FilterNomeInput) {
    const parsed = filterNomeSchema.parse(filters)
    const { items } = await this.filterNome.execute(parsed)
    return items.map(NomeViewModel.toHttp)
  }
}
```

### DTO com Zod
```typescript
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const createNomeSchema = z.object({
  campo: z.string({ required_error: 'Campo obrigatório' }),
  clienteId: z.string().uuid().optional(),
})

export class CreateNomeBody extends createZodDto(createNomeSchema) {}
```

### Exception
```typescript
import { createExceptionFactory } from '@/common/errors/exception-factory'

export const NomeException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Registro não encontrado' },
  alreadyExists: { type: 'conflict', message: 'Registro já existe' },
})
```

### Repository (abstract)
```typescript
@Injectable()
export abstract class NomeRepository {
  abstract findById(id: string): Promise<Nome | null>
  abstract findAll(filters: FilterNomeInput): Promise<Nome[]>
  abstract findPaginated(filters: FilterNomeInput, pagination: PaginationProps): Promise<NomePaginated>
  abstract create(entity: Nome): Promise<Nome>
  abstract save(entity: Nome): Promise<void>
}
```

### PrismaRepository (implementação)
```typescript
@PrismaRepository(NomeRepository)
@Injectable()
export class PrismaNomeRepository implements NomeRepository {
  constructor(private prisma: PrismaService) {}
  // implementação com PrismaNomeMapper.toDomain() e toPrisma()
}
```

---

## IDs E TIPOS

- Sentinella usa **UUID** para todos os IDs (diferente do ManFrota que usa Int autoincrement)
- BaseEntity usa `id?: string` (UUID)
- Prisma: `@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`

---

## MÓDULOS A IMPLEMENTAR (por ordem de prioridade)

### Fase 1 — Auth + Cadastros base ✅ (scaffold pronto)
1. ✅ `auth` — login JWT, refresh token
2. ✅ `usuario` — CRUD, papéis, vínculo cliente
3. 🔲 `cliente` — CRUD de municípios (tenant)

### Fase 2 — Domínio operacional
4. `regiao` — CRUD com GeoJSON/PostGIS
5. `imovel` — CRUD, importação em lote
6. `ciclo` — gerenciamento de ciclos de levantamento
7. `levantamento` — levantamentos + itens + detecções + evidências
8. `foco-risco` — CRUD + máquina de estados (UseCase: TransicionarFocoRisco)
9. `vistoria` — CRUD + depósitos + sintomas + riscos + calhas

### Fase 3 — SLA + Operação
10. `sla` — configuração, cálculo, alertas
11. `operacao` — operações com vínculos
12. `planejamento` — planejamentos ativos

### Fase 4 — Integrações
13. `drone` — drones + voos + pipeline YOLO
14. `cloudinary` — upload/delete de evidências
15. `notificacao` — push web, e-SUS/SINAN
16. `cnes` — sync de unidades de saúde

### Fase 5 — Analytics + Jobs
17. `dashboard` — endpoints analytics/BI
18. `billing` — planos, ciclos, quotas
19. `job` — fila de jobs (substituir edge functions)

---

## EDGE FUNCTIONS → NESTJS SERVICES

Mapeamento das 23 edge functions para services/jobs NestJS:

| Edge Function | Destino NestJS | Tipo |
|---|---|---|
| `billing-snapshot` | BillingService.snapshot() | @Cron |
| `cloudinary-upload-image` | CloudinaryService.upload() | Service |
| `cloudinary-delete-image` | CloudinaryService.delete() | Service |
| `cloudinary-cleanup-orfaos` | CloudinaryService.cleanup() | @Cron |
| `cnes-sync` | CnesService.sync() | @Cron |
| `criar-usuario` | UsuarioUseCase.create() | UseCase |
| `geocode-regioes` | RegiaoService.geocode() | Service |
| `graficos-regionais` | DashboardService.graficosRegionais() | Service |
| `health-check` | HealthService.check() | @Cron |
| `identify-larva` | IaService.identifyLarva() | Service |
| `insights-regional` | DashboardService.insightsRegional() | Service |
| `job-worker` | JobService.processQueue() | @Cron |
| `limpeza-retencao-logs` | AuditService.cleanupLogs() | @Cron |
| `liraa-export` | LiraaService.export() | Service |
| `notif-canal-cidadao` | NotificacaoService.canalCidadao() | Service |
| `pluvio-risco-daily` | PluvioService.dailyRisk() | @Cron |
| `relatorio-semanal` | RelatorioService.semanal() | @Cron |
| `resumo-diario` | DashboardService.resumoDiario() | Service |
| `score-worker` | ScoreService.process() | @Cron |
| `sla-marcar-vencidos` | SlaService.marcarVencidos() | @Cron |
| `sla-push-critico` | SlaService.pushCritico() | @Cron |
| `triagem-ia-pos-voo` | IaService.triagemPosVoo() | Service |
| `upload-evidencia` | CloudinaryService.uploadEvidencia() | Service |

---

## REFERÊNCIAS

### Arquivos de referência do frontend (sentinelaweb_sources)
- `src/services/api.ts` — 5448 linhas, todas as chamadas Supabase. **Cada método aqui vira um endpoint REST.**
- `src/types/database.ts` — 2011 linhas, todos os tipos TypeScript do banco
- `src/hooks/queries/` — 65 hooks React Query (nomenclatura = endpoints necessários)
- `docs/REGRAS_DE_NEGOCIO_OFICIAIS.md` — regras de negócio canônicas
- `docs/07-regras-de-negocio.md` — regras detalhadas
- `supabase/functions/` — 23 edge functions para migrar

### Arquivos de referência do backend (ms-api-finance)
- `src/modules/bank/` — exemplo completo do padrão SOLID a seguir
- `src/shared/` — infraestrutura reutilizada (base entity, prisma, pagination)
- `src/guards/auth.guard.ts` — padrão JWT
- `src/decorators/prisma-repository.decorator.ts` — auto-registro de repos

---

## REGRAS PARA O CLAUDE

1. **Sempre** seguir o padrão SOLID: Controller → UseCase → Entity → Repository → Mapper → ViewModel
2. **Nunca** acessar Prisma diretamente no Controller ou UseCase — usar Repository abstrato
3. **Nunca** retornar entity direto — sempre usar ViewModel.toHttp()
4. **Nunca** misturar regra de negócio no Controller — lógica fica no UseCase
5. **Sempre** validar input com Zod schema no Controller antes de chamar UseCase
6. **Sempre** filtrar por `cliente_id` em queries de tenant (usar request['tenantId'])
7. **Sempre** gerar registro em `foco_risco_historico` ao transicionar foco
8. **Sempre** usar `createExceptionFactory` para erros de domínio
9. **Nunca** criar papel `platform_admin` — usar `admin`
10. **Nunca** tratar agente e operador como papéis distintos — são o mesmo

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
ANTHROPIC_API_KEY=...      # Claude Haiku Vision (identify-larva)
```

---

## COMO INICIAR

```bash
pnpm install
cp .env.example .env       # preencher variáveis
pnpm generate              # gera Prisma client
pnpm start:dev             # roda em modo watch
# Swagger: http://localhost:3333/api-docs
# Scalar:  http://localhost:3333/reference
```
