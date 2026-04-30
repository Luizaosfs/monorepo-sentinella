# Sentinella Web — Cutover Ready

> **Propósito deste arquivo.** Declarar publicamente (pra mim mesmo) que o
> backend `ms-api-sentinella` está pronto para pré-venda. Lista o que está
> pronto, o que sei que falta e por que **não é bloqueador**, e o critério
> objetivo para *parar de auditar*.
>
> **Quando reabrir este arquivo:** apenas (a) quando o primeiro cliente
> pagante reportar problema concreto, ou (b) quando uma feature de regra
> de negócio exigir tocar em código listado abaixo. Auditoria proativa
> está suspensa.
>
> **Última revisão:** 30/abr/2026.

---

## 1. O que está pronto

Estado verificado no código em 30/abr/2026 (não em `.md` desatualizados).

### Migração e arquitetura
- ✅ NestJS 11 + Prisma 7 + Zod cutover-ready
- ✅ 32 módulos backend organizados em `src/modules/`
- ✅ Padrão SOLID Controller → UseCase → Repository → Mapper → ViewModel
- ✅ 4 guards globais via `APP_GUARD`: `Throttle → Auth → Roles → Tenant`
- ✅ Opt-out explícito via `@Public()` e `@SkipTenant()`

### Multitenancy e segurança
- ✅ `AccessScope` discriminated union (PlatformScope/MunicipalScope/RegionalScope)
  em `src/shared/security/access-scope.ts`
- ✅ Helpers `getAccessScope`, `getClienteIdsPermitidos`, `requireTenantId`,
  `requireClientePermitido` em `access-scope.helpers.ts`
- ✅ `assertTenantOwnership` em `tenant-ownership.util.ts` cobre o gap dos
  use-cases legados (validação a posteriori após `findById`)
- ✅ AccessScope adotado em **7 módulos** (228 ocorrências de helpers):
  dashboard, foco-risco, levantamento, operação, reinspeção, sla, vistoria
- ✅ `findById` filtra por `cliente_id` quando passado (comentário
  `MT-06: filtra por cliente_id quando informado (impede IDOR cross-tenant)`)
- ✅ RLS removido; segurança 100% NestJS
- ✅ Papéis canônicos: admin, supervisor, agente, notificador,
  analista_regional. `platform_admin` e `operador` são valores mortos.

### Audit-log e LGPD
- ✅ Audit-log Prisma extension implementada e aplicada em `prisma.service.ts`:
  `applyUpdatedAtExtension(...).$extends(createdByExtension).$extends(buildAuditLogExtension(...))`
- ✅ Padrão fail-safe transparente (fire-and-forget + try/catch silencioso)
- ✅ Cobertura inicial: `papeis_usuarios`, `cliente_plano`,
  `cliente_integracoes`, `usuarios` — escopo fechado deliberadamente em
  4 tabelas administrativas
- ✅ `senha_hash` e `api_key` filtrados por `sanitize()`
- ✅ Cron `redactSensitiveLogs` (LGPD) ativo às 2h via `JobScheduler`

### Cron secret rotacionado
- ✅ Cron secret exposto em dump pg_cron foi rotacionado.
- ✅ Varredura final no repo (30/abr/2026) confirma: zero ocorrências do
  valor antigo em código, scripts ou migrations
  (`grep -rn "147852369" .` → 0 hits).
- ✅ Procedimento documentado em
  `docs/operacao/checklist-rotacao-secret-cron.md`.

### Frontend
- ✅ Livre de chamadas Supabase ativas — varredura
  (`grep -rn "supabase\." apps/frontend/src`) só retorna 2 strings
  literais em descrições de teste e 1 valor de enum em comentários
- ✅ React 18 + Vite + TanStack Query + shadcn/ui

### Cron jobs e agendamento
- ✅ 5 classes com `@Cron`: `JobScheduler` (11 crons), `CnesScheduler` (1),
  `PluvioScheduler` (1), `ReinspecaoScheduler` (1), `HealthCheckService` (1)
- ✅ Crons LGPD/operacionais restaurados na Fase A:
  `slaMarcarVencidos` (15min), `relatorioSemanal` (segunda 8h),
  `scoreDiario` (7h), `redactSensitiveLogs` (2h)

### Documentação viva
- ✅ `apps/backend/CLAUDE.md` — 502 linhas, fonte de verdade arquitetural
- ✅ `apps/frontend/CLAUDE.md` — 202 linhas
- ✅ `docs/operacao/checklist-rotacao-secret-cron.md` — playbook operacional

---

## 2. O que sei que falta — e por que não é bloqueador para pré-venda

Itens conhecidos, todos mitigados ou de baixo risco operacional.
**Nenhum impede onboarding do primeiro cliente.**

### 2.1 Audit-log cobre 4 tabelas, não todas as LGPD
- **Estado:** `papeis_usuarios`, `cliente_plano`, `cliente_integracoes`, `usuarios`.
- **Por que não bloqueia:** decisão arquitetural deliberada, registrada em
  `apps/backend/CLAUDE.md` linha 245 ("escopo fechado em 4 tabelas
  administrativas"). Tabelas com dados de saúde (notificações de casos,
  vistorias, focos) ainda têm `created_by`/`updated_by`/`alterado_por` via
  extension `created-by`, suficiente para responsabilização individual.
- **Quando endereçar:** quando o primeiro cliente formalizar exigência LGPD
  específica de trilha de auditoria sobre dados de saúde, ou quando
  certificação compliance demandar.
- **Custo de adiar:** baixo — adicionar tabela à `AUDIT_CONFIG` é additive
  (1 entrada no Map + 3 testes), sem refactor.

### 2.2 Use-cases legados ainda usam `req['tenantId'] as string`
- **Estado:** 169 ocorrências em 76 arquivos não-spec, em 26 módulos.
- **Por que não bloqueia:** o padrão funciona — combinado com
  `assertTenantOwnership` cobre o gap. O `apps/backend/CLAUDE.md` linha 444
  já documenta a regra ("Ao criar novo código, sempre passar tenant no
  `findById`"); novos módulos seguem AccessScope. Os 7 módulos críticos
  (operação, foco-risco, dashboard, sla, vistoria, levantamento,
  reinspecao) já estão migrados.
- **Quando endereçar:** oportunisticamente — quando uma feature de regra
  de negócio fizer tocar em módulo legado, migra naquela hora. Não há
  data limite.
- **Custo de adiar:** zero — não é dívida que cresce, é dívida estática.

### 2.3 Validação cross-tenant de IDs estrangeiros no body
- **Estado:** endpoints como `POST /operacoes`, `POST /focos-risco/:id/atribuir-agente`,
  `PUT /imoveis/:id` aceitam `responsavelId`/`agenteId`/`regiaoId`/`focoRiscoId`
  e os escrevem sem checar se cada ID pertence ao mesmo cliente.
- **Por que não bloqueia:** ataque exige (a) usuário autenticado com role
  municipal, (b) conhecimento de UUID de recurso de outro cliente. UUIDs
  v4 não são adivinháveis. FK do banco previne corrupção referencial. O
  pior cenário realista é vazamento por colaborador interno
  multi-tenant — improvável na pré-venda.
- **Quando endereçar:** primeiro cliente municipal real, ou primeiro
  pen-test contratado.
- **Custo de adiar:** baixo — adicionar `requireClientePermitido` antes
  do save é mecânico.

### 2.4 CSP e Service Worker do frontend ainda permitem `*.supabase.co`
- **Estado:** `apps/frontend/vite.config.ts` (cache SW) e
  `apps/frontend/index.html` (CSP `connect-src`) referenciam supabase.
- **Por que não bloqueia:** **cosmético**. Sem chamada Supabase ativa no
  código, o navegador nunca emite request pra esses domínios. Permitir
  `connect-src` extra não vaza dado — só amplia superfície *teórica*.
- **Quando endereçar:** primeiro PR que tocar no frontend deploy config.
- **Custo de adiar:** zero.

---

## 3. Critério de "não vou mais auditar"

A partir de **30/abr/2026**, **não abro nova conversa pedindo auditoria**.
Reabro `docs/CUTOVER-READY.md` apenas quando:

1. **Cliente pagante reportar problema concreto** — bug, indisponibilidade,
   pedido de feature. Aí o item do bug é o foco; não revisamos os outros.
2. **Feature nova de regra de negócio exigir tocar código auditado** — aí
   migra o módulo *naquela hora* (oportunístico, item 2.2 acima).
3. **Pen-test ou auditoria externa formal** — relatório externo é input
   objetivo, não opinião de outro Claude.
4. **Mudança regulatória LGPD/ANPD** que torne 2.1 obrigatório com prazo.

**O que NÃO é gatilho para reabrir:**
- Ansiedade de "será que falta algo".
- Outra conversa com Claude/LLM sugerindo melhorias.
- Comparação com benchmark de "como deveria estar".
- Vontade de polir antes de mostrar pra cliente.

---

## 4. Próximo passo

A partir de agora, o trabalho é **regra de negócio e venda**, não código.
Próxima conversa neste repo deve começar com pergunta de **feature** ou
**operação** (onboarding de prefeitura, pitch, integração nova,
melhoria de UX da operação) — não com pergunta de auditoria.

Se em algum momento a tentação de auditar voltar: reler **seção 3** acima.