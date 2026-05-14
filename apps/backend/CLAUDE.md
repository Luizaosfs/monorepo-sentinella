# CLAUDE.MD — MS-API-SENTINELLA

> ## ⚠️ ESTADO REAL DO BANCO (verificado 2026-05-14)
>
> **O banco de produção NestJS tem ZERO triggers de aplicação e ZERO funções `fn_*`/`rpc_*` PL/pgSQL.** Todas as ~102 triggers e ~100+ funções do schema Supabase legado foram **removidas** na migração e portadas para use-cases TypeScript.
>
> - **Não confie em qualquer doc, COMMENT em tabela ou audit que diga "ao inserir/atualizar X, a trigger Y faz Z"** — a trigger não existe mais. A mecânica é o use-case TS, embora o COMPORTAMENTO esperado descrito nesses docs continue válido.
> - **Fonte canônica:** [`docs/DB_STATE_ATUAL.md`](../../docs/DB_STATE_ATUAL.md) (na raiz do monorepo).
> - **Como reverificar:** `SELECT * FROM pg_trigger WHERE NOT tgisinternal` deve retornar só `topology.layer.layer_integrity_checks` (extensão PostGIS, não nosso código).

## VISÃO GERAL

Backend REST API do **Sentinella Web** — plataforma B2G SaaS de vigilância entomológica para municípios brasileiros no combate ao Aedes aegypti (dengue/chikungunya/zika).

**Stack:** NestJS 11 · Prisma 7.7.0 · Zod 3.24 · JWT · PostgreSQL 17 · PostGIS 3.6.2
**Arquitetura:** SOLID com Use Cases — Controller → UseCase → Repository → Mapper → ViewModel

---

## CONTEXTO

Migração do Supabase concluída (2026-04-20, Fase 6 de 6).

- Auth: JWT HS256 próprio (`SECRET_JWT`) + refresh tokens em `public.refresh_tokens`
- Storage: Cloudinary (`CloudinaryService`)
- Edge Functions: NestJS services + `@nestjs/schedule`
- RLS: Removido. Segurança via `AuthGuard` + `TenantGuard` (ambos globais via `APP_GUARD`)
- Analytics: Use Cases com `$queryRaw` inline. Existem views PostgreSQL declaradas em `prisma/migrations/create_analytics_views.sql` (legado de compatibilidade), mas o código TypeScript não as consome (`grep "v_executivo_kpis" src/` → 0).

---

## ARQUITETURA SOLID — PADRÃO PARA MÓDULOS DE DOMÍNIO

Estrutura canônica (módulos de domínio — ex.: `foco-risco`, `vistoria`, `imovel`, `sla`, `operacao`, `levantamento`, `plano-acao`, `drone`):

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

Nem todos os 32 módulos seguem essa estrutura completa. Módulos de infraestrutura / serviços transversais usam formas enxutas, orientadas a services:

- `auth/` — sem `entities/`/`repositories/`/`view-model/`. Tem `email.service.ts`, `use-cases/`, `dtos/`.
- `cloudinary/`, `ia/`, `seed/` — apenas `controller` + `module` + `*.service.ts`.
- `piloto/`, `recorrencias/`, `alerta-retorno/` — apenas `controller` + `module` + `use-cases/`.
- `agrupamentos/` — `controller` + `module` + `dtos` + `use-cases/` (+ `tags.controller.ts`).
- `denuncia/` — sem `entities/`/`repositories/`/`view-model/`. Tem `dtos/`, `errors/`, `use-cases/`.
- `cnes/` — sem `entities/`/`repositories/`/`view-model/`. Tem `cnes.service.ts`, `cnes.scheduler.ts`, `use-cases/`.
- `dashboard/` — múltiplos controllers (`analitico`, `analytics`, `dashboard`, `eficacia`, `executivo`, `health`, `piloto`, `reincidencia`, `territorial`, `tiles`) + services (`dashboard-scheduler`, `health-check`, `liraa-export`) + estrutura domínio. `territorial.controller.ts` expõe `GET /dashboard/territorial`. `tiles.controller.ts` expõe `GET /tiles/:service/:z/:y/:x` (MVT map tiles).
- `job/` — estrutura domínio + `job.scheduler.ts` + `score-worker.service.ts` + `audit-cleanup.service.ts`.
- `notificacao/` — estrutura domínio + `push.service.ts` + `canal-cidadao.service.ts` + `helpers/`.

Implementação Prisma em:
```
src/shared/modules/database/prisma/
├── repositories/prisma-{nome}.repository.ts   # @PrismaRepository decorator
└── mappers/prisma-{nome}.mapper.ts            # toDomain() + toPrisma()
```

### Fluxo de request
```
Request → ThrottlerGuard → AuthGuard → RolesGuard → TenantGuard
  → Controller (Zod parse) → UseCase (regra de negócio)
  → Repository (abstract) → PrismaRepository (implementação)
  → Mapper.toDomain() / toPrisma()
  → ViewModel.toHttp() → Response
```

Os 4 guards são **globais** via `APP_GUARD` em `src/app.module.ts` (ordem: `throttle → auth → roles → tenant`). Não declarar `@UseGuards(...)` nos controllers — o app não declara nenhum dos 4 guards em controllers (`grep -rn "UseGuards(TenantGuard" src/` → 0). Opt-out explícito via `@Public()` (sem auth) ou `@SkipTenant()` (autenticado sem tenant).

---

## MÓDULOS (39)

Saída real de `ls apps/backend/src/modules/ | sort`:

```
agrupamentos              alerta-retorno            auth
billing                   ciclo                     cliente
cloudinary                cnes                      cobertura-operacional
consolidacao-pesos-config dashboard                 denuncia
drone                     foco-risco                ia
imovel                    implantacao-operacional   import-log
job                       levantamento              notificacao
operacao                  piloto                    planejamento
plano-acao                pluvio                    quarteirao
recorrencias              regiao                    reincidencia-territorial
reinspecao                risk-engine               security-log
seed                      sla                       territorial-importacao
territorial-saneamento    usuario                   vistoria
```

Módulos adicionados após a documentação original (abr-mai/2026):
- `cobertura-operacional` — analytics de cobertura: resumo, quarteirões, agentes, imóveis nunca visitados (`GET /cobertura-operacional/{resumo,quarteiroes,agentes,imoveis-nunca-visitados}`)
- `consolidacao-pesos-config` — configuração de pesos de consolidação de score (estrutura domínio mínima, sem use-cases além de testes)
- `implantacao-operacional` — operações de implantação (controller + module + use-cases + view-model, `errors/`)
- `reincidencia-territorial` — analytics de reincidência por resumo/imóveis/quarteirões/bairros (`GET /reincidencia-territorial/{resumo,imoveis,quarteiroes,bairros}`)
- `security-log` — log de eventos de segurança (controller + service + repositories + view-model; use-cases: `list-security-logs`, `security-logs-stats`)
- `territorial-importacao` — importação de dados territoriais (parsers, services, entities, dtos, use-cases)
- `territorial-saneamento` — saneamento de dados territoriais (entities, services, use-cases)

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
- `TenantGuard` injeta `request['accessScope']` (ver `access-scope.helpers.ts`); `request['tenantId']` foi removido (mai/2026)
- Admin sem `cliente_id` seleciona tenant via `?clienteId=xxx`
- Todo repository de tenant DEVE filtrar por `cliente_id`

### Máquina de estados — focos_risco (11 estados)

Fonte da verdade: `TRANSICOES_VALIDAS` em `src/modules/foco-risco/entities/foco-risco.ts`.

Transições válidas **pelo endpoint genérico** `POST /focos-risco/:id/transicionar`:
- `suspeita` → `em_triagem`
- `em_triagem` → `aguarda_inspecao` | `descartado`
- `aguarda_inspecao` → `descartado`
- `em_inspecao` → `confirmado` | `aguarda_inspecao` | `descartado`  ← back-transition permitida
- `aguardando_nova_tentativa` → `descartado` | `encaminhado_administrativo` | `acionado_juridico`
- `confirmado` → `em_tratamento`
- `em_tratamento` → `resolvido` | `descartado`
- `resolvido` → (terminal)
- `descartado` → (terminal)
- `encaminhado_administrativo` → (terminal)
- `acionado_juridico` → (terminal)

**`aguarda_inspecao` → `em_inspecao` NÃO passa pelo endpoint genérico.** Essa transição ocorre pelo use-case `IniciarInspecao` via endpoint próprio `PATCH /focos-risco/:id/iniciar-inspecao` (evento operacional + histórico `inicio_inspecao`). Comentário explícito em `entities/foco-risco.ts` reforça isso.

Toda transição DEVE gerar registro em `foco_risco_historico` (append-only).
`resolvido` e `descartado` são terminais — não reabre; cria novo foco com `foco_anterior_id`.

### SLA
- Prazo canônico: `sla_operacional.prazo_final` (banco)
- SLA é criado pelo backend durante o fluxo do foco confirmado (ver módulo `sla/` e view-model `foco-risco/view-model/foco-sla-snapshot.ts`). A criação inicial em `sla_operacional` visível no código TypeScript ocorre em bulk pelo use-case `pluvio/use-cases/gerar-slas-run.ts`; para focos individuais confirmados, a criação pode depender de trigger SQL — consultar os use-cases antes de alterar.
- Configurável por cliente e por região (`sla_config`, `sla_config_regiao`)

### PostGIS
- `bairros.area` — `geometry(Polygon,4326)` — populado automaticamente pelo `PrismaRegiaoWriteRepository` a partir do campo `geojson` via `ST_GeomFromGeoJSON()`
- `planejamentos.area` — `geometry(Polygon,4326)`
- Índices GIST em ambas as colunas para `ST_Contains` no despacho de agentes

### Analytics — sem views consumidas pelo código
Toda query analítica (dashboard executivo, piloto, regional, eficácia, reincidência) é implementada como Use Case com `$queryRaw` inline. O arquivo `prisma/migrations/create_analytics_views.sql` declara views (ex.: `v_executivo_kpis`) por compatibilidade histórica, mas **nenhuma é consumida pelo TypeScript** (`grep -r v_executivo_kpis src/` → 0). Não introduzir novas views sem consumo TS correspondente.

---

## PADRÕES DE CÓDIGO

### Controller
Guards (Throttle/Auth/Roles/Tenant) são globais — não declarar no controller.

```typescript
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

### Extensions do Prisma Client

`PrismaService` aplica `$extends` no construtor. O getter `get client()` retorna o cliente **estendido** — 668 usos em `src/modules/**` são transparentemente cobertos.

| Extension | Arquivo | Função |
|---|---|---|
| `updated-at` | `shared/modules/database/prisma/extensions/updated-at.extension.ts` | Injeta `updated_at = new Date()` em `update`/`updateMany`/`upsert.update` para 36 modelos específicos. Substitui o trigger SQL `trg_<tabela>_updated_at` do Supabase legado (perdido na migração). Respeita valor explícito do chamador. |
| `created-by` | `shared/modules/database/prisma/extensions/created-by.extension.ts` | Injeta autoria automática em 6 tabelas LGPD. **INSERT** → `created_by` (focos_risco/casos_notificados/vistorias) ou `alterado_por` (foco_risco_historico/levantamento_item_status_historico). **UPDATE** → `updated_by` (levantamento_itens). Lê `request.user.id` via `ClsServiceManager.getClsService()`; NULL silencioso fora de request (crons, seeds) — replica comportamento `auth.uid()` do Supabase. Aplicado via `.$extends(createdByExtension)` direto em `prisma.service.ts` (sem factory genérica — quebraria TypeMap do Prisma). |
| `audit-log` | `shared/modules/database/prisma/extensions/audit-log.extension.ts` + `audit-log.config.ts` | Grava automaticamente em `audit_log` as operações INSERT/UPDATE/DELETE de 4 tabelas administrativas/LGPD: `papeis_usuarios`, `cliente_plano`, `cliente_integracoes`, `usuarios` (UPDATE só quando `ativo` muda). Campos sensíveis filtrados: `senha_hash`, `api_key`. Resolve `cliente_id` para `audit_log.cliente_id` (lookup extra em `usuarios.auth_id` para `papeis_usuarios`) e traduz `auth_id` do CLS → `usuarios.id` para `audit_log.usuario_id`. **Fail-safe transparente:** escrita fire-and-forget + try/catch silencioso — falha em audit NUNCA quebra a operação de negócio. Usa `rawClient` (sem extensions) para evitar recursão. Aplicado via `.$extends(buildAuditLogExtension(this.prisma))` em `prisma.service.ts`. |

**Dependência da B.1:** `UserContextInterceptor` (`shared/interceptors/user-context.interceptor.ts`) registrado globalmente via `APP_INTERCEPTOR` em `app.module.ts` — propaga `request.user.id` para CLS na key `'sentinella:userId'` (exportada como `CLS_USER_ID_KEY`).

**Nota Prisma 7:** `prisma.$use(...)` foi removido na v7. Todas as extensões de comportamento global devem usar `Prisma.defineExtension` + `$extends`.

**Nota operacional (Fase B.2, abr/2026):** antes desta fase, todo `UPDATE` deixava `updated_at` congelado no valor do INSERT — quebrando cache invalidation, ordenação por "mais recente" e lógica temporal. O extension restaura esse comportamento **no app**, sem recriar trigger no banco.

**Fase B COMPLETA (abr/2026):** ~~`updated_at`~~ (B.2) + ~~`created_by`/`updated_by`/`alterado_por`~~ (B.1) + ~~`audit_log`~~ (B.3) agora todos automatizados via Prisma Extensions encadeados. Os 3 triggers originais do Supabase (`trg_*_updated_at`, `fn_set_*_from_jwt`, `fn_audit_trail`) estão replicados no app.

**Gap descoberto em mai/2026 — `levantamento_itens.cliente_id`:** o trigger SQL legado `trg_levantamento_itens_set_cliente_id` (que denormalizava `cliente_id` do `levantamentos` pai) foi removido na migração e **não tem Prisma extension equivalente**. Resultado: 209 itens gravados com `cliente_id NULL` em produção (todos os focos de drone do pipeline Python davam 404 em `GET /levantamentos/itens/:id` porque o filtro `WHERE cliente_id = ?` falha em NULL). **Fix aplicado (2026-05-14):** (a) backfill `UPDATE levantamento_itens SET cliente_id = l.cliente_id FROM levantamentos l WHERE li.levantamento_id = l.id AND li.cliente_id IS NULL`; (b) `create-levantamento-item.ts` passa `clienteId: levantamento.clienteId` explicitamente em `createItem`; (c) projeto Python `D:\sentinella\sentinela\src\sentinela\services\supabase_upload.py` inclui `"cliente_id": cliente_id` no dict do item em ambos os fluxos (batch e single-row REST). `criar-item-manual.ts` já passava — sem mudança necessária. **Lição:** qualquer trigger SQL legado que populava colunas FK denormalizadas deve ter cobertura explícita no use-case OU Prisma extension dedicada; não confiar que "o banco preenche".

**Nota operacional (Fase B.3, abr/2026):** escopo fechado em 4 tabelas administrativas. `usuarios` audita UPDATE apenas quando `ativo` muda (evita ruído de edição de perfil). O padrão é fail-safe: qualquer erro na gravação do `audit_log` é engolido silenciosamente — trilha de auditoria NUNCA pode quebrar a request. Ampliar o escopo exige adicionar entrada em `AUDIT_CONFIG` (audit-log.config.ts) + teste em `audit-log.config.spec.ts`.

---

## CRON JOBS (`@nestjs/schedule`)

Apenas **4 classes** possuem métodos `@Cron`:

| Classe | Arquivo | Crons | Responsabilidades |
|---|---|---|---|
| `JobScheduler` | `modules/job/job.scheduler.ts` | 11 | Orquestrador central. `processQueue` (a cada minuto, consome `job_queue`) + `billingSnapshot` (meia-noite) + `slaMarcarVencidos` (`*/15 * * * *`) + `slaPushCritico` (`*/15 * * * *`) + `relatorioSemanal` (`0 8 * * 1`, segunda 8h) + `resumoDiario` (meia-noite) + `cloudinaryCleanup` (semanal) + `limpezaLogs` (3h) + `escalarFocosSuspeitos` (horária) + `scoreDiario` (7h, enfileira `recalcular_score_lote` por cliente) + `redactSensitiveLogs` (2h, LGPD — invoca `AuditCleanupService.redactSensitiveFields`). |
| `CnesScheduler` | `modules/cnes/cnes.scheduler.ts` | 1 | `EVERY_WEEK` — sync CNES. |
| `PluvioScheduler` | `modules/pluvio/pluvio.scheduler.ts` | 1 | `0 6 * * *` — risco pluvial. |
| `ReinspecaoScheduler` | `modules/reinspecao/reinspecao.scheduler.ts` | 1 | `0 6 * * *` — marcar reinspeções vencidas. |
| `HealthCheckService` | `modules/dashboard/health-check.service.ts` | 1 | `*/5 * * * *` — ping de sanidade. |

Nomes terminados em `*SchedulerService` (ex.: `SlaSchedulerService`, `BillingSchedulerService`, `DashboardSchedulerService`, `PluvioSchedulerService`) **não são cron** — são services sem `@Cron`, invocados pelo `JobScheduler`.

> **Exceção:** `HealthCheckService` (em `dashboard/`) **tem `@Cron` próprio** (ping */5min), embora siga o sufixo `*Service` — ele é o único service com cron direto fora dos 4 schedulers principais.
>
> **Aviso (Fase A, abr/2026):** o cron `slaMarcarVencidos` foi restaurado de `0 6 * * *` para `*/15 * * * *` e `relatorioSemanal` de diário para `0 8 * * 1` (segunda 8h). O cron `scoreDiario` (equivalente ao `score-recalculo-diario` do pg_cron legado) passou a existir. O cron `redactSensitiveLogs` (equivalente LGPD ao `retencao-logs-redact`) passou a existir.
>
> **Débito resolvido (mai/2026):** a escalada usa `ESCALA_PRIORIDADE = ['P5','P4','P3','P2','P1']` em `escalar-sla.ts` — paridade com o formato real do banco. O débito documentado aqui era referente a uma versão anterior do código.

---

## REGRAS ESPECÍFICAS POR MÓDULO

### foco-risco
- Toda transição de status gera registro em `foco_risco_historico`
- `score_prioridade` calculado pelo trigger `trg_recalcular_score_prioridade` — não atualizar manualmente
- Colunas não existentes no schema atual de `levantamento_itens` (removidas em migrações anteriores ao monorepo): `status_atendimento`, `acao_aplicada`, `data_resolucao` — não referenciar

### Fase C.3 — Auto-criação de Foco (abr/2026)

Porte de 3 funções SQL do legado Supabase para TypeScript, mais a incorporação
do comportamento de `fn_auto_triagem_foco` (focos nascem direto em
`status='em_triagem'`, sem passar por `suspeita`):

| Legado (SQL)                                 | Novo (TS)                                                                                  | Gatilho                                                   |
|----------------------------------------------|--------------------------------------------------------------------------------------------|-----------------------------------------------------------|
| `fn_prioridade_para_p`                       | `prioridadeParaP` (util puro, `foco-risco/use-cases/auto-criacao/prioridade-para-p.ts`)    | —                                                         |
| `fn_criar_foco_de_levantamento_item`         | `CriarFocoDeLevantamentoItem` (`foco-risco/use-cases/auto-criacao/`)                       | Após `CreateLevantamentoItem` e `CriarItemManual`         |
| `fn_criar_foco_de_vistoria_deposito`         | `CriarFocoDeVistoriaDeposito` (`foco-risco/use-cases/auto-criacao/`)                       | Após `AddDeposito` e `CreateVistoriaCompleta`             |
| `fn_auto_triagem_foco`                       | (incorporado) — todos os INSERTs já usam `status='em_triagem'`                             | —                                                         |

**Filtro de criação (paridade fiel com legado):**
- `payload.fonte = 'cidadao'` (cidadão) — sempre cria foco.
- Demais origens — só cria se `prioridade ∈ {P1,P2,P3}` OR `risco ∈ {alto, crítico, critico}`.

**Match de imóvel (PostGIS):** `ST_DWithin((lng,lat)::geography, imoveis.geo, 30)`
(raio 30m). Se achar, usa `imovel_id`; senão usa apenas as coordenadas.

**origem_tipo:** `cidadao` (se payload.fonte), `drone` (se `tipoEntrada='drone'`
no planejamento), `agente` (caso padrão / vistoria).

**Padrão de integração (best-effort):** os 2 hooks rodam FORA de qualquer
`$transaction` do use-case de domínio. Cada hook é envolto em `try/catch` com
`logger.error`. Falha na auto-criação de foco NUNCA impede a criação do
levantamento-item, depósito ou vistoria completa.

**Chain C.3 → C.4:** tanto `CriarFocoDeLevantamentoItem` quanto
`CriarFocoDeVistoriaDeposito` chamam `CruzarFocoNovoComCasos` best-effort
após inserir o foco — permite que focos recém-criados já sejam cruzados com
casos notificados próximos no mesmo fluxo.

**Dedup em vistoria:** o legado tinha trigger que populava `vistorias.foco_risco_id`
quando um foco era criado com `origem_vistoria_id`. No schema atual não existe
esse trigger (verificado no dump de 2026-04-19). Para preservar paridade
prática (1 foco por vistoria), `CreateVistoriaCompleta` itera `data.depositos`
e dá `break` no primeiro com `comLarva=true`. `AddDeposito` avançado ainda
checa `foco_risco_id` da vistoria antes de criar (short-circuit se já houver).

**Circular deps:** nenhum forwardRef necessário. `LevantamentoModule` e
`VistoriaModule` importam `FocoRiscoModule`; `FocoRiscoModule` não importa
nenhum dos dois.

**Rollback:** `apps/backend/scripts/rollback-fase-C3.sql` (code-only — sem
alterações de schema).

### Fase C.4 — Cruzamento caso↔foco (PostGIS, abr/2026)

Porte dos 3 triggers SQL bidirecionais que mantinham a relação geográfica entre `casos_notificados` e `focos_risco` (raio 300m) para 3 use-cases TypeScript:

| Legado (SQL)                                    | Novo (TS)                                                            | Gatilho                                    |
|-------------------------------------------------|----------------------------------------------------------------------|--------------------------------------------|
| `fn_cruzar_caso_com_focos`                      | `CruzarCasoComFocos` (`modules/notificacao/use-cases/`)              | Após criar caso notificado                 |
| `fn_cruzar_foco_novo_com_casos`                 | `CruzarFocoNovoComCasos` (`modules/foco-risco/use-cases/`)           | Após criar foco (com `origem_levantamento_item_id`) |
| `fn_reverter_prioridade_caso_descartado`        | `ReverterPrioridadeCasoDescartado` (`modules/notificacao/use-cases/`)| `SaveCaso` na transição PARA `descartado`  |

`fn_sincronizar_casos_foco` **NÃO foi portado** — era redundante com os 3 hooks acima (mesma atualização de `casos_ids` / `prioridade_original_antes_caso` / `prioridade='P1'`).

**Tabela alvo:** `caso_foco_cruzamento` (singular). Chave única: `(caso_id, levantamento_item_id)`. Por isso os cruzamentos só existem para focos com `origem_levantamento_item_id IS NOT NULL` — restrição do schema, preservada do legado.

**Padrão de integração (best-effort):** os 3 hooks rodam FORA da `$transaction` do use-case de domínio. O hook é envolto em `try/catch` com `logger.error`. Falha no cruzamento NUNCA impede a criação do caso/foco ou a transição de status. Regra: "cruzamento é otimizador operacional; nunca bloqueia fluxo de negócio".

**Bugs do legado preservados (decisão deliberada):**

- `CruzarCasoComFocos` e `CruzarFocoNovoComCasos` só atualizam focos com `prioridade IS DISTINCT FROM 'P1'`. Consequência: focos já em P1 não recebem o `caso_id` em `casos_ids`. Reproduz comportamento original do `UPDATE ... WHERE prioridade <> 'P1'`.
- `ReverterPrioridadeCasoDescartado` restaura `prioridade` via `COALESCE(prioridade_original_antes_caso, prioridade)` e zera o backup (paridade fiel com `fn_reverter_prioridade_caso_descartado`, D-02). Correção do patch aplicado em 21-abr-2026 após auditoria — implementação inicial tinha deixado a linha do `COALESCE` fora por malentendido do comportamento legado.
- Cruzamento só é criado se o foco tem `origem_levantamento_item_id` (restrição de schema, idêntica ao legado).

**`denunciar-cidadao-v2.ts` NÃO chama `CruzarFocoNovoComCasos`** — denúncias de cidadão criam foco com `origem_tipo='cidadao'` sem `origem_levantamento_item_id`, então o hook seria no-op de qualquer forma. Idêntico ao legado (que também não fazia nada para esses focos por falta da FK de cruzamento).

**Rollback:** `apps/backend/scripts/rollback-fase-C4.sql` (code-only — sem alterações de schema).

### Fase C.5 — Guards DELETE LGPD (abr/2026)

Defesa em profundidade contra hard delete em `clientes`, `imoveis` e `vistorias` (tabelas com dados de saúde pública / LGPD). **Apenas camada code-level** — a política do projeto é zero triggers no banco; toda regra de domínio fica em use-cases/testes.

**Code-level (invariante estática):** `src/shared/test/delete-guards.invariant.spec.ts` varre os repositórios Prisma e falha no CI se alguém introduzir `.delete({...})` ou `.deleteMany({...})` nessas 3 tabelas. Quebra a build antes de chegar em runtime.

**Exceptions dedicadas:** `ClienteException.deleteBloqueado`, `ImovelException.deleteBloqueado`, `VistoriaException.deleteBloqueado` — usar caso algum use-case futuro precise recusar um delete explicitamente.

**Padrão canônico de "delete":** soft delete via `ativo=false + deleted_at=now()`. Cliente e vistoria **não têm endpoint DELETE** (intencional — não existe caso de uso legítimo). Imóvel tem `DeleteImovel` use-case que já chama `softDelete(id, userId, clienteId)`.

**Descartado:** o arquivo `c5_delete_guards.sql` (triggers `trg_bloquear_delete_*`) e o e2e `c5-delete-guards.e2e.spec.ts` foram removidos — a trava DB-level conflita com a diretriz "tudo via use-case".

### Fase C.6 — Seeds on Cliente Insert (abr/2026)

Porte de **7 triggers AFTER INSERT** em `clientes` do Supabase legado para um único use-case TypeScript `SeedClienteNovo` (`modules/cliente/use-cases/seed-cliente-novo.ts`), invocado dentro do `$transaction` de `CreateCliente`.

| Legado (SQL trigger / função)                              | Novo (TS helper privado)        | Tabela alvo                          |
|------------------------------------------------------------|---------------------------------|--------------------------------------|
| `trg_seed_cliente_plano` → `trg_seed_cliente_plano()`     | `seedClientePlano`              | `cliente_plano` (linka plano "basico") |
| `trg_seed_cliente_quotas` → `trg_seed_cliente_quotas()`   | `seedClienteQuotas`             | `cliente_quotas`                     |
| `trg_seed_score_config` → `fn_seed_score_config()`        | `seedScoreConfig`               | `score_config` (cliente_id é PK)     |
| `trg_seed_sla_foco_config` → `fn_seed_sla_foco_config()`  | `seedSlaFocoConfig`             | `sla_foco_config` (4 fases)          |
| `trg_seed_sla_feriados_on_cliente` → `seed_sla_feriados_nacionais()` | `seedSlaFeriados` | `sla_feriados` (20 feriados 2025-2026) |
| `trg_seed_drone_risk_config_on_cliente` → `seed_drone_risk_config()` | `seedDroneRiskConfig` + `seedYoloClassConfig` + `seedYoloSynonyms` | `sentinela_drone_risk_config` (1) + `sentinela_yolo_class_config` (8) + `sentinela_yolo_synonym` (5) |
| `trg_seed_plano_acao_catalogo_on_cliente` → `seed_plano_acao_catalogo()` + `seed_plano_acao_catalogo_por_tipo()` | `seedPlanoAcaoCatalogo` | `plano_acao_catalogo` (10 genéricos + 12 por tipo = 22) |

**Atomicidade:** o INSERT do cliente + os 7 seeds rodam dentro do mesmo `$transaction(callback)`. Falha em qualquer seed faz rollback do cliente — paridade fiel com o legado, onde falha em trigger AFTER INSERT abortava o INSERT da raiz.

**Diferença do padrão Fase C.1/C.3/C.4 (best-effort):** aqui NÃO há try/catch interno. Setup de cliente novo é uma operação de configuração que precisa ser íntegra — diferente de hooks operacionais (SLA, cruzamento de focos) que são otimizadores e não devem bloquear fluxo de negócio.

**Repository tx-aware:** `ClienteWriteRepository.create(cliente, tx?)` aceita `tx` opcional. `PrismaClienteWriteRepository.create` faz `(tx as typeof this.prisma.client) ?? this.prisma.client` — único caller (CreateCliente) sempre passa tx.

**Idempotência:** preservada conforme legado:
- `cliente_plano`/`cliente_quotas`/`score_config`/`sentinela_drone_risk_config` — `upsert` (cliente_id UNIQUE).
- `sla_foco_config`/`sla_feriados`/`sentinela_yolo_class_config`/`sentinela_yolo_synonym` — `createMany skipDuplicates: true` (composto UNIQUE: `(cliente_id, fase|data|item_key|synonym)`).
- `plano_acao_catalogo` — `count() === 0` guard manual (genéricos por `tipo_item IS NULL`, e por cada tipo) — espelha `IF NOT EXISTS` do `seed_plano_acao_catalogo_por_tipo`.

**Migration de schema necessária:** `prisma/migrations/c6_seeds_uniques.sql` adiciona 7 constraints UNIQUE faltantes + 3 `DEFAULT now()` em `created_at`/`updated_at` que não existiam no schema importado. Aplicar com `psql -f` antes de subir o código.

**Plano "basico" requerido:** se a tabela `planos` não tiver registro com `nome='basico'`, `seedClientePlano` retorna `'pulado_sem_plano_basico'` (warn no log). Demais seeds prosseguem normalmente. Cliente fica sem `cliente_plano` até alguém criar manualmente.

**Rollback:** `apps/backend/scripts/rollback-fase-C6.sql` (drops das constraints/defaults adicionados pela migration). Para reverter o use-case basta `git revert` — não há triggers SQL para recriar.

### reinspecao
- `ReinspecaoScheduler` (cron diário `0 6 * * *`) marca reinspeções pendentes como vencidas.
- Criação manual via use-case `modules/reinspecao/use-cases/criar-manual.ts`.
- **Fase C.2 (abr/2026):** criação automática pós-tratamento e cancelamento em massa ao fechar foco migraram dos triggers SQL `fn_criar_reinspecao_pos_tratamento` / `fn_cancelar_reinspecoes_ao_fechar_foco` para 2 use-cases TypeScript: `CriarReinspecaoPosTratamento` (dispara no `em_tratamento`, cria pendente com `data_prevista = now() + 7 dias`, tipo `eficacia_pos_tratamento`, origem `tratamento_confirmado`) e `CancelarReinspecoesAoFecharFoco` (dispara em `resolvido`/`descartado`, cancela todas pendentes com motivo `Foco fechado automaticamente`). Invocados dentro do mesmo `$transaction(callback)` do `TransicionarFocoRisco` criado na Fase C.1. Reaproveitam a compensação em `sla_erros_criacao` (variável `slaError` é compartilhada entre hooks para simplicidade).
- Idempotência de `CriarReinspecaoPosTratamento` é via `findFirst` pendente (o schema atual não traz o unique partial index do Supabase legado).
- Máx. 1 reinspeção pendente por `(foco_risco_id, tipo)` — invariante mantido em software; restrição histórica do banco ainda documentada mas não enforced em CONSTRAINT no self-hosted.

### quarteirao
Módulo rico com gestão territorial completa. Use-cases: `create-quarteirao`, `save-quarteirao`, `delete-quarteirao`, `filter-quarteiroes`, `bulk-insert-quarteiroes`, `desenhar-quarteirao` (geometria manual), `gerar-lote-quarteiroes`, `gerar-quadras-osm` (geração via OpenStreetMap), `importar-geojson-quarteiroes`, gestão de distribuições por ciclo (`create-distribuicao`, `filter-distribuicoes`, `upsert-distribuicoes`, `deletar-distribuicoes`, `delete-distribuicao`, `copiar-distribuicao`, `list-distribuicoes-by-agente`) e `cobertura-ciclo`.

### regiao
- `area geometry(Polygon,4326)` populada via `ST_GeomFromGeoJSON(geojson::text)` no `PrismaRegiaoWriteRepository.syncArea()`
- `ST_Contains(bairros.area, ponto)` usado no despacho para inferir `bairro_id` automaticamente

### sla
- `sla_foco_config` define prazos por fase
- `sla_config_regiao` sobrepõe config geral por região
- Feriados via `sla_feriados` (por cliente)
- **Fase C.1 (abr/2026):** criação e fechamento de SLA por foco migraram dos triggers SQL `fn_iniciar_sla_ao_confirmar_foco` / `fn_vincular_sla_ao_confirmar` / `fn_fechar_sla_ao_resolver_foco` para 3 use-cases TypeScript: `IniciarSlaAoConfirmarFoco`, `FecharSlaAoResolverFoco`, `ResolveSlaConfig`. Eles são invocados dentro de `$transaction(async (tx) => {...})` no `TransicionarFocoRisco` — primeiro uso do padrão **transação interativa** no backend. Diferente do `$transaction([array])` pré-existente, o callback permite lógica entre queries (ex.: idempotência + vínculo + create ON CONFLICT).
- **Padrão de compensação:** se o hook de SLA falhar dentro da tx, o erro é **capturado** (não relançado) — foco + histórico ainda commitam. A falha é gravada em `sla_erros_criacao` **FORA da transação** (caso contrário seria revertida com ela). O `.catch()` final do log-de-log engole erro residual — trilha de erro de SLA NUNCA pode quebrar a request.
- **ResolveSlaConfig:** resolve prioridade → slaHoras na ordem `sla_config_regiao` → `sla_config` → fallback hard-coded (P1=4, P2=12, P3=24, P4=72, P5=168). `Logger.warn` ao cair no fallback, para visibilidade operacional de clientes sem config.

### ia
- Cache `ia_insights` verificado antes de chamar Claude Haiku
- `force_refresh=true` no body ignora cache

### cnes
- `uf` + `ibge_municipio` no cliente são obrigatórios para sync
- Unidades com `origem='manual'` e `cnes IS NULL` nunca são inativadas
- Inativação: `ativo=false`, nunca DELETE

### denuncia
Controller `@Controller('denuncias')` (plural). 4 rotas reais:

| Método | Rota | Auth | Throttle | Use-case |
|---|---|---|---|---|
| POST | `/denuncias/cidadao` | `@Public()` | 5/min (`{ limit: 5, ttl: 60_000 }`) | `DenunciarCidadaoV2` (TS) |
| POST | `/denuncias/upload-foto` | `@Public()` | 5/min | `UploadFotoDenuncia` |
| GET  | `/denuncias/stats` | `@Roles('admin','supervisor','analista_regional')` | (sem @Throttle) | `CanalCidadaoStats` |
| GET  | `/denuncias/consultar` | `@Public()` | 30/min | `ConsultarDenuncia` |

- Controller usa `DenunciarCidadaoV2` diretamente (sem flag de alternância). `CANAL_CIDADAO_V2_ENABLED` existe no schema Zod mas não é consumido pelo controller — V2 está sempre ativo.
- Retorno de V2: `{ protocolo, id }` (protocolo = primeiros 8 chars do `foco_id` sem hífens).
- `GET /denuncias/consultar` usa `ConsultarDenuncia` TypeScript puro (`$queryRaw` em `focos_risco`) — sem dependência de função SQL legada.
- Hash de IP usa `env.CANAL_CIDADAO_IP_SALT`.

---

## SEGURANÇA — NÃO REVERTER

- `platform_admin` é valor morto — nenhum usuário deve tê-lo.
- Proteção cross-tenant: o repositório `findById(id, clienteId?)` filtra por `cliente_id` quando o `clienteId` é passado. Use-cases de domínio DEVEM passar `tenantId` no `findById`. Parte dos use-cases ainda usa `findById(id)` sem tenant e faz validação `assert`/`assertTenantOwnership` a posteriori (`src/shared/security/tenant-ownership.util.ts`). Ao criar novo código, **sempre passar tenant no `findById`** — não confiar em asserts a posteriori.
- `DenunciarCidadaoV2` (TS) cria `focos_risco` diretamente com rate limit de 5/min por IP. V1 SQL foi removido.
- Sem RLS no banco — toda segurança é NestJS guards (`AuthGuard`, `RolesGuard`, `TenantGuard`) e asserts em use-cases.
- `TenantGuard` é global via `APP_GUARD`; opt-out via `@Public()` ou `@SkipTenant()`.
- `request['tenantId']` foi removido do `TenantGuard` (mai/2026) — todos os callers usam `getAccessScope(req).tenantId` via `access-scope.helpers.ts`. Não reintroduzir o campo legado.

---

## IMPLEMENTAÇÕES MAI/2026

### Backfill bairro_id (imovel)
`POST /imoveis/backfill-bairro` (`@Roles('admin')`) — use-case `PreencherBairroImoveis` (`imovel/use-cases/preencher-bairro-imoveis.ts`):
- **Passo 1 (PostGIS):** `ST_Contains(bairros.area, imoveis.geo)` — preenche `bairro_id` para imóveis com coordenadas.
- **Passo 2 (texto):** `imoveis.bairro ILIKE bairros.nome` — preenche os restantes por nome.
- Idempotente: só atualiza linhas com `bairro_id IS NULL`.
- Retorno: `{ postgis, texto, total }`.

### Dashboard territorial — tratamentos executados
`GET /dashboard/territorial` agora inclui `tratamentosExecutados` no response:
```typescript
tratamentosExecutados: {
  larvicida: { depositosUsaram: number; totalGramas: number };
  eliminacao: { totalDepositos: number };
}
```
Dados vêm de `vistoria_depositos.usou_larvicida` e `qtd_larvicida_g` (sem schema change).
Campo `depositosComLarvicida` e `totalLarvicidaG` também adicionados em cada item de `depositosPncd.porTipo`.

---

## VARIÁVEIS DE AMBIENTE

Fonte: `src/lib/env/server.ts` (Zod).

**Obrigatórias (sem default):**
```env
DATABASE_URL=postgresql://...
SECRET_JWT=...
```

**Com default:**
```env
JWT_EXPIRES_IN=7d                         # default '7d'
REFRESH_TOKEN_EXPIRES_IN=30d              # default '30d'
PORT=3333                                 # default '3333'
NODE_ENV=development                      # enum development|production|test, default development
SMTP_PORT=587                             # default '587'
CANAL_CIDADAO_IP_SALT=sentinella-dev-salt # default 'sentinella-dev-salt'
CANAL_CIDADAO_V2_ENABLED=true             # default true — V2 sempre ativo (controller não lê mais esta flag)
```

**Opcionais (sem default):**
```env
CLIENT_URL=https://app.exemplo.com,https://admin.exemplo.com  # obrigatória em produção (main.ts lança erro com NODE_ENV != 'development' se ausente)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
ANTHROPIC_API_KEY=
ESUS_API_URL=
ESUS_API_TOKEN=
CNES_API_URL=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
GOOGLE_MAPS_KEY=
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
