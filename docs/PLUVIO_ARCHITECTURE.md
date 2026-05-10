# Arquitetura do Módulo Pluvio

Módulo de risco pluviométrico preventivo territorial do Sentinella. Monitora precipitações via Open-Meteo e classifica regiões por nível de risco sem criar focos no sistema operacional.

---

## Responsabilidade

O módulo **não cria focos_risco**. Chuva é risco preventivo territorial — sua unidade de dado é `pluvio_risco`, não `foco_risco`. Qualquer tentativa de criar um foco com `origemTipo='pluvio'` é bloqueada via Zod `.refine()` no DTO `CreateFocoRiscoBody`.

---

## Tabelas

### `pluvio_risco`
Série temporal de risco pluviométrico por região e data de referência.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `bairro_id` | uuid | FK → `bairros` |
| `cliente_id` | uuid (nullable) | Denormalizado — pode ser NULL |
| `dt_ref` | date | Data de referência (YYYY-MM-DD) |
| `chuva_24h` | float | Precipitação nas últimas 24h (mm) |
| `chuva_72h` | float | Precipitação nos últimos 3 dias (mm) |
| `chuva_7d` | float | Precipitação nos últimos 7 dias (mm) |
| `dias_pos_chuva` | int | Dias com precipitação > 1mm nos últimos 7 dias |
| `persistencia_7d` | float | `dias_pos_chuva / 7` (0–1) |
| `tendencia` | string | `crescente` \| `decrescente` \| `estavel` |
| `nivel_risco` | string | `baixo` \| `medio` \| `alto` \| `critico` |
| `situacao_ambiental` | string | `normal` \| `atencao` \| `favoravel_proliferacao` |

**Constraint única:** `(bairro_id, dt_ref)` — uma leitura por bairro por dia.

### `pluvio_operacional_run` / `pluvio_operacional_item`
Tabelas de CRUD manual para registro de operações pluviométricas avulsas. Separadas do scheduler. Não populadas pelo cron diário.

---

## Fluxo diário (Scheduler)

```
PluvioScheduler @Cron('0 6 * * *')
  └─ PluvioSchedulerService.riscoDaily()
       ├─ busca todos os clientes ativos
       ├─ para cada cliente, busca regiões com lat/lng
       └─ para cada região:
            ├─ AbortController 10s timeout
            ├─ GET Open-Meteo /v1/forecast (7 dias passado + 3 previsão)
            ├─ calcula chuva_24h / chuva_72h / chuva_7d / persistencia_7d / tendencia
            ├─ classifica nivel_risco e situacao_ambiental
            └─ upsert pluvio_risco WHERE (bairro_id, dt_ref)
```

**Classificação de risco:**
| Condição | Nível |
|---|---|
| `chuva_24h > 30` OR `chuva_72h > 60` | `critico` |
| `chuva_24h > 15` OR `chuva_72h > 30` | `alto` |
| `chuva_7d > 50` | `medio` |
| demais | `baixo` |

**Resiliência:** falha em uma região é capturada individualmente (try/catch) e contabilizada em `erros`. Regiões sem coordenadas são contadas em `puladas`. O scheduler retorna `{ regioes, atualizadas, erros, puladas }`.

---

## Use Cases

| Arquivo | Responsabilidade |
|---|---|
| `risco-by-cliente.ts` | Query lateral — retorna `nivel_risco`, `chuva_24h`, `dt_ref`, `updated_at` mais recente por região do cliente |
| `get-alerta-territorial.ts` | DISTINCT ON — último registro por região, filtra meio/alto/critico, gera justificativas e recomendações |
| `get-storm-forecast.ts` | Busca previsão Open-Meteo por região, classifica alertas, cache em memória 10min |
| `filter-items.ts` | Lista itens de uma `pluvio_operacional_run` |
| `gerar-slas-run.ts` | Gera SLAs para uma run operacional |
| `update-run-total.ts` | Atualiza totais de uma run |
| `upsert-item.ts` | Cria ou atualiza item operacional |

---

## Fluxo storm-forecast (PR-PLUVIO-02)

```
Browser → GET /pluvio/storm-forecast
  └─ PluvioController.stormForecast()
       └─ GetStormForecast.execute(clienteId)
            ├─ verifica cache em memória (TTL 10min por clienteId)
            │    ├─ HIT  → retorna imediatamente
            │    └─ MISS → continua
            ├─ prisma.regioes.findMany({ cliente_id, deleted_at: null })
            ├─ filtra regiões com lat/lng
            ├─ Promise.allSettled(regioes.map(r => OpenMeteoService.fetchStormForecast(lat, lng)))
            │    └─ AbortController 8s timeout por região
            ├─ classifyAlerts() — thresholds idênticos ao frontend legado
            ├─ ordena critico → alto → moderado
            ├─ popula cache
            └─ retorna StormForecastAlert[]
```

**Motivação da backendificação:** o frontend chamava Open Meteo diretamente do browser, gerando ausência de cache, duplicidade de chamadas por tab aberta, risco de rate limit, e lógica climática espalhada. Toda chamada externa ao Open Meteo passa agora exclusivamente pelo backend.

**Classificação de alerta (thresholds preservados do frontend legado):**
| Precipitação (mm) | Tipo | Severidade |
|---|---|---|
| ≥ 50 | Tempestade forte | `critico` |
| 20–49 | Chuva intensa | `alto` |
| 10–19 | Chuva moderada | `moderado` |
| < 10 | (ignorado) | — |

Vento no D+0: ≥ 90 km/h → `critico`, 60–89 km/h → `alto`.

**Cache em memória:**
- TTL: 10 minutos por `clienteId`
- Implementação: `Map<string, { data; expiresAt }>` no singleton `GetStormForecast`
- **Limitação conhecida:** cache por instância de processo — em deploy multi-pod cada pod tem cache próprio. Se necessário, migrar para Redis via `CacheModule` do NestJS.

**Resiliência:** `Promise.allSettled` — falha de uma região não aborta as demais. Logs estruturados: início, total regiões, cache hit/miss, falhas, tempo total (ms).

---

## Frontend

### Hook
`useStormAlerts(clienteId)` — chama `GET /pluvio/storm-forecast` via `pluvio.getStormForecast()`. Sem fetch direto ao Open Meteo. `staleTime: STALE.MODERATE` (5min).

### Widget
`StormAlertWidget` — exibe alertas ordenados por severidade (`critico → alto → moderado`). Em caso de erro do backend: exibe "Dados climáticos temporariamente indisponíveis" sem stacktrace.

---

## Fluxo alerta-territorial (PR-PLUVIO-03)

```
Browser → GET /pluvio/alerta-territorial
  └─ PluvioController.alertaTerritorial()
       └─ GetAlertaTerritorial.execute(clienteId)
            ├─ $queryRaw — DISTINCT ON (bairro_id) ORDER BY bairro_id, dt_ref DESC
            │    (último registro por região, sem scan de corrida)
            ├─ filtra nivel_risco ∈ {medio, alto, critico}
            ├─ mapeia → AlertaTerritorialItem (justificativas + recomendação)
            ├─ ordena critico → alto → medio
            └─ retorna AlertaTerritorialResponse
                 { atualizadoEm, totalRegioesMonitoradas, totalRegioesEmAlerta, severidadeGeral, alertas[] }
```

**Diferença alerta vs foco:** `GET /pluvio/alerta-territorial` é somente leitura — não cria focos, SLAs ou eventos operacionais. A unidade de dado é `pluvio_risco`, não `focos_risco`.

**Diferença risco pluvial vs SLA:** risco pluvial é preventivo territorial (toda a região). SLA é operacional por imóvel (endereço específico). Os dois domínios não se cruzam.

**ViewModel puro:** `alerta-territorial.vm.ts` contém 3 funções puras exportadas e testadas independentemente: `calcularSeveridadeGeral`, `gerarJustificativas`, `gerarRecomendacao`.

**Regras de recomendação:**
| Nível | Recomendação |
|---|---|
| `critico` | Priorizar vistoria preventiva nas próximas 24h |
| `alto` | Reforçar cobertura territorial nas próximas 48h |
| `medio` | Monitorar e manter rota preventiva |
| `baixo` | Sem ação extraordinária |

**Limitação conhecida — cross-join com cobertura operacional:** o cruzamento `pluvio_risco ↔ cobertura_operacional/reincidência` **não é possível** sem migração de schema. `cobertura_operacional` agrupa por `quarteirao` (texto) e `distribuicao_quarteirao`; `reincidência` agrupa por `quarteirao/bairro` (texto em `imoveis`). Nenhuma dessas tabelas tem FK para `bairros.id`. O campo `operacao` foi omitido do `AlertaTerritorialItem` por esse motivo. Roadmap: adicionar `bairro_id` em `cobertura_operacional` como coluna calculada via PostGIS.

**Frontend:**
- `usePluvioAlertaTerritorial(clienteId)` — `staleTime: STALE.MODERATE` (5min), queryKey `['pluvio-alerta-territorial', clienteId]`
- `PluvioAlertaWidget` — widget compacto na `CentralOperacional`, oculto quando não há alertas ou em caso de erro. Mostra severidade geral, regiões em alerta, máx. chuva 72h, recomendação principal e botão "Ver alerta territorial".
- `GestorPluvioAlertaTerritorial` — página completa em `/gestor/pluvio/alerta-territorial` com KPIs, banner de status, tabela de regiões com justificativas e disclaimer de risco preventivo.

---

## Integração com focos

O campo `origem_tipo='pluvio'` pode aparecer em `focos_risco` legados (importados do Supabase). O use-case `auto-classificar-foco` os classifica como tipo `'risco'` para exibição nos dashboards analíticos (`get-piloto-funil-hoje` conta esses focos).

**Novos focos com `origemTipo='pluvio'` são bloqueados** — o DTO `CreateFocoRiscoBody` tem `.refine()` que rejeita esse valor com HTTP 422.

---

## Multitenancy

- `pluvio_risco.cliente_id` é **nullable** (campo denormalizado, pode ser NULL em registros legados).
- O controller `PluvioController` usa `requireTenantId` apenas nas rotas de runs operacionais. A rota `GET /pluvio/risco` usa `getAccessScope` para suportar tanto admin quanto supervisor.
- `risco-by-cliente.ts` filtra por `regioes.cliente_id` — o join é a barreira de tenant.
