# 11 — Melhorias Priorizadas

## Objetivo deste documento

Listar melhorias concretas, viáveis e priorizadas para o sistema Sentinella Web, com justificativa, esforço estimado e impacto esperado. Nenhuma melhoria proposta aqui requer reescrita total — todas são incrementais e podem ser implementadas sem interromper o sistema em operação.

> **Para quem é este documento:** tech lead ou desenvolvedor sênior planejando sprints, gestor técnico avaliando ROI de melhorias, qualquer desenvolvedor que queira entender o que deve ser feito antes de adicionar mais funcionalidades.

> **Referências cruzadas:** cada melhoria cita o item de dívida técnica (`DT-XX`) ou risco (`RS-XX`, `RD-XX`, `RO-XX`, `RR-XX`, `RE-XX`) que resolve, conforme catalogados em `09-divida-tecnica.md` e `10-riscos-e-falhas.md`.

---

## Legenda

| Campo | Valores possíveis |
|-------|------------------|
| Esforço | Baixo (< 4h) · Médio (1–3 dias) · Alto (1–2 semanas) |
| Risco da mudança | Baixo · Médio · Alto |
| Backend impactado | `api.ts`, Edge Functions, pipeline Python |
| Frontend impactado | Componentes, hooks, rotas |
| Banco impactado | Migrations, triggers, funções |
| RLS impactada | Políticas de Row Level Security |

---

## GRUPO 1 — Quick Wins (baixo esforço, alto impacto)

Essas melhorias podem ser feitas em horas, sem risco, e eliminam problemas sérios imediatamente.

---

### QW-01 — Verificar e remover usuário de desenvolvedor de produção

**Resolve:** DT-09, RD-02
**Esforço:** Baixo
**Risco da mudança:** Baixo

| Dimensão | Impacto |
|----------|---------|
| Backend | Nenhum |
| Frontend | Nenhum |
| Banco | Verificação em `auth.users` + possível DELETE |
| RLS | Nenhum |

**Problema que resolve:**
A migration `20250306160000_seed_operador_luiz.sql` pode ter criado um usuário de desenvolvimento em produção, com acesso real a dados de prefeituras.

**Como fazer:**
```sql
-- 1. Verificar se existe
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE email ILIKE '%luiz%' OR email ILIKE '%dev%' OR email ILIKE '%test%';

-- 2. Se encontrado, desativar via Supabase Auth Admin API ou remover
-- (nunca deletar diretamente de auth.users sem usar a API)
```

**Dependências:** Acesso ao banco de produção.
**Ordem recomendada:** Fazer hoje, antes de qualquer outra mudança.

---

### QW-02 — Verificar RLS nas tabelas sem confirmação

**Resolve:** RS-03
**Esforço:** Baixo
**Risco da mudança:** Baixo (verificação), Médio (se precisar criar migration corretiva)

| Dimensão | Impacto |
|----------|---------|
| Backend | Nenhum |
| Frontend | Nenhum |
| Banco | Query de verificação + possível migration |
| RLS | Habilitação de RLS em tabelas descobertas sem proteção |

**Problema que resolve:**
Tabelas `yolo_feedback` e `levantamento_analise_ia` podem não ter RLS habilitado, permitindo que um usuário autenticado acesse dados de outras prefeituras.

**Como fazer:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('yolo_feedback', 'levantamento_analise_ia',
                    'unidades_saude_sync_controle', 'unidades_saude_sync_log')
ORDER BY tablename;
```

Se `rowsecurity = false` para qualquer linha, criar migration:
```sql
ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;
CREATE POLICY "isolamento_cliente" ON nome_tabela
  USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()));
```

**Dependências:** Acesso ao banco de produção.
**Ordem recomendada:** Fazer em paralelo com QW-01.

---

### QW-03 — ~~Corrigir sobrescrita do `payload` em cruzamentos de surto~~ — CONCLUÍDO

**Status:** ✅ Concluído — sem alteração de código necessária
**Resolução:** Diagnóstico histórico — bug já corrigido por migrations anteriores
**Verificado em:** 2026-07-12

**Resolve:** DT-12, RD-01

#### O que foi encontrado
Diagnóstico completo revelou que o bug foi corrigido em duas etapas históricas:

1. **Migration `20260604000000` (R-38):** trigger `fn_cruzar_caso_com_focos` corrigido para acumular em array em vez de sobrescrever
2. **Migrations `20260710020000` + `20260710030000`:** relação caso↔foco migrada para `focos_risco.casos_ids`; `payload` limpo de todas as chaves de caso

O frontend (`ItemCasosNotificados.tsx`, `api.casosNotificados.*`) nunca consumiu as chaves problemáticas do `payload` — sempre consultou `caso_foco_cruzamento` via RPC.

#### Decisão arquitetural registrada (ADR-QW03)
O campo `payload` JSONB de `levantamento_itens` não deve ser usado para relações entre entidades. Relações são armazenadas em:
- `caso_foco_cruzamento` — tabela relacional, fonte canônica de vínculos (many-to-many)
- `focos_risco.casos_ids` — UUID[], aggregate root para acesso rápido

#### Ação realizada
Apenas atualização documental. Documentos corrigidos: `05-banco-de-dados.md`, `07-regras-de-negocio.md`, `08-fluxos-operacionais.md`, `09-divida-tecnica.md`, `10-riscos-e-falhas.md`.

---

### QW-04 — Auditoria completa de RLS e views (security_invoker) — CONCLUÍDO

**Status:** ✅ Concluído — sem migration nova necessária
**Resolução:** Diagnóstico histórico — todos os itens já corrigidos por migrations anteriores
**Verificado em:** 2026-07-12

**Escopo auditado:**
- Tabelas filhas de `vistorias` (`vistoria_depositos`, `vistoria_sintomas`, `vistoria_riscos`, `vistoria_calhas`)
- Views sem `security_invoker`
- Tabelas auxiliares (`push_subscriptions`, `yolo_feedback`, `levantamento_analise_ia`, `plano_acao_catalogo`, `sla_feriados`, `sla_config_regiao`, `cliente_quotas`, etc.)

#### O que foi encontrado

**Tabelas filhas de vistoria:** todas tinham RLS habilitado desde as migrations originais (`20250318001000`, `20250318002000`). As policies foram aprimoradas em `20260319233000` para usar `usuario_pode_acessar_cliente()` com `EXISTS` via join a `vistorias` (para as que não têm `cliente_id` direto).

**Views:** todas as views pré-2026 foram corrigidas pela migration `20260607000000_fix_security_definer_views` via `ALTER VIEW ... SET (security_invoker = on)`. As views da fase focos_risco (2026-07-10) foram criadas diretamente com `WITH (security_invoker = true)`.

**Tabelas auxiliares:** todas confirmadas com RLS habilitado desde suas migrations de criação (março 2025).

#### Decisão arquitetural registrada (ADR-QW04)
Toda nova view deve ser criada com `WITH (security_invoker = true)` — sem exceções. Views sem esta diretiva executam com os privilégios do criador (postgres com `BYPASSRLS`), ignorando o RLS das tabelas subjacentes e expondo dados de todos os clientes para qualquer usuário autenticado.

#### Ação realizada
Apenas auditoria e documentação. Documento atualizado: `docs/06-rls-e-seguranca.md`.

---

### QW-05 — Correções de sincronização offline (idempotência + evidências) — CONCLUÍDO

**Status:** ✅ Concluído
**Resolução:** Três correções incrementais implementadas
**Verificado em:** 2026-07-13

**Escopo:**
Auditoria do sistema offline identificou três problemas reais: (1) ausência de proteção contra duplicatas no retry, (2) perda silenciosa de assinatura/foto sem aviso ao operador, (3) UI defasada após drain por falta de invalidação de queries.

#### O que foi implementado

**Correção 1 — Idempotência (R1 — Problema real / Risco Alto):**
- Migration `20260713000000`: índice `UNIQUE(imovel_id, agente_id, ciclo, data_visita)` na tabela `vistorias`
- `drainQueue()` em `offlineQueue.ts`: captura erro `23505` (unique_violation) no catch — trata como "já processado", remove da fila sem contar como falha

**Correção 2 — Sinalização de pendências (R2 — Problema real / Risco Alto):**
- Migration `20260713000000`: colunas `pendente_assinatura` e `pendente_foto` (`boolean NOT NULL DEFAULT false`) na tabela `vistorias`
- `drainQueue()`: após `createCompleta`, detecta `assinatura_responsavel_url === null` (vistoria com acesso) ou `foto_externa_url === null` (vistoria sem acesso) e chama `api.vistorias.marcarPendencias()`
- `useOfflineQueue.ts`: toast persistente (10s) quando `vistoriasPendentes > 0`
- `OperadorListaImoveis.tsx`: badge âmbar "Pendente" com ícone `AlertTriangle` no card do imóvel

**Correção 3 — Invalidação de queries (R5 — Problema real / Risco Baixo):**
- `useOfflineQueue.ts`: após drain, invalida `['vistorias']`, `['imoveis']` e `['vistoria-resumo']`

#### Arquivos alterados
- `supabase/migrations/20260713000000_vistoria_idempotencia_offline.sql` (nova migration)
- `src/types/database.ts` — campos `pendente_assinatura`, `pendente_foto` em `Vistoria`
- `src/services/api.ts` — `api.vistorias.marcarPendencias()`
- `src/lib/offlineQueue.ts` — idempotência 23505, rastreio `vistoriasPendentes`, chamada `marcarPendencias`
- `src/hooks/useOfflineQueue.ts` — toast de pendência + invalidações pós-drain
- `src/pages/operador/OperadorListaImoveis.tsx` — mapa `pendenciasPorImovel` + badge no card

---

### QW-06 — Auditoria e correções do sistema de SLA automático — CONCLUÍDO

**Status:** ✅ Concluído
**Resolução:** Auditoria completa + três correções incrementais implementadas
**Verificado em:** 2026-07-14

**Escopo:**
Auditoria técnica do sistema de SLA (prazos, triggers, cálculos, escalação, reabertura) identificou fragilidades que causavam comportamento incorreto operacionalmente.

#### O que foi implementado

**Correção 1 — Reabrir SLA recalcula prazo (F2 — Problema real / Risco Alto):**
- Migration `20260714000000`: função `reabrir_sla(p_sla_id uuid)` que volta o SLA para `pendente`, redefine `inicio = now()` e recalcula `prazo_final` usando `sla_calcular_prazo_final()` com respeito a feriados e horário comercial
- `api.sla.reabrir()` em `api.ts`: substituído update direto por `supabase.rpc('reabrir_sla', ...)`
- Antes: SLA reaberto mantinha prazo original já expirado → ficava vencido em 60s

**Correção 2 — Trigger de SLA registra erros (F3 — Problema real / Risco Alto):**
- Migration `20260714000000`: tabela `sla_erros_criacao` (levantamento_item_id, erro, criado_em) com RLS para admin/gestor
- Trigger `trg_levantamento_item_criar_sla_auto` atualizado: `EXCEPTION WHEN others` agora insere em `sla_erros_criacao` em vez de silenciar; fallback final em `RAISE WARNING` se o log também falhar
- Antes: qualquer erro de SLA era silenciado com `RETURN NEW`, item ficava invisível no painel

**Correção 3 — Clarificar papel de `calcularSlaHoras()` (F1 — Problema real / Risco Médio):**
- `src/types/sla.ts`: JSDoc extenso adicionado em `calcularSlaHoras()` deixando explícito que é simulação visual — nunca deve ser usado como prazo oficial
- `src/services/api.ts`: comentário atualizado em `api.sla.reabrir()`
- `docs/07-regras-de-negocio.md`: RN-S1 e RN-S3 corrigidos; RN-S8 e RN-S9 adicionados

#### Arquivos alterados
- `supabase/migrations/20260714000000_sla_reabrir_e_log_erros.sql` (nova migration)
- `src/services/api.ts` — `api.sla.reabrir()` agora usa RPC
- `src/types/sla.ts` — JSDoc de `calcularSlaHoras()` clarificado
- `docs/07-regras-de-negocio.md` — RN-S1, RN-S3, RN-S8, RN-S9

---

### QW-07 — Rastreabilidade mínima operacional — CONCLUÍDO

**Status:** ✅ Concluído
**Resolução:** Três correções incrementais implementadas via migration e TypeScript
**Verificado em:** 2026-07-15

**Escopo:**
Auditoria de logs (QW-07 diagnóstico) identificou ausência de rastreabilidade em ações críticas: quem escalou/reabriu SLAs, se a vistoria veio do offline, quem alterou um item de levantamento.

#### O que foi implementado

**Correção 1 — escalado_por / reaberto_por em sla_operacional:**
- Migration `20260715000000`: colunas `escalado_por uuid REFERENCES usuarios(id)` e `reaberto_por uuid REFERENCES usuarios(id)` adicionadas
- `escalar_sla_operacional()` e `reabrir_sla()` resolvem `auth.uid()` → `usuarios.id` internamente e gravam o campo correspondente
- Antes: impossível saber quem disparou escalação ou reabertura de SLA

**Correção 2 — origem_offline em vistorias:**
- Migration `20260715000000`: `ALTER TABLE vistorias ADD COLUMN origem_offline boolean NOT NULL DEFAULT false`
- `create_vistoria_completa()` aceita `origem_offline` no payload JSONB
- `offlineQueue.ts` `drainQueue()`: passa `origem_offline: true` ao sincronizar `save_vistoria`
- Antes: impossível distinguir vistorias online das sincronizadas do modo offline

**Correção 3 — updated_by em levantamento_itens:**
- Migration `20260715000000`: coluna `updated_by uuid REFERENCES usuarios(id)` adicionada
- Trigger `trg_set_updated_by` (`BEFORE UPDATE`) resolve `auth.uid()` → `usuarios.id` e preenche `updated_by` + `updated_at` automaticamente
- Antes: qualquer atualização de item era anônima

#### Arquivos alterados
- `supabase/migrations/20260715000000_qw07_rastreabilidade.sql` (nova migration)
- `src/types/sla.ts` — campos `escalado_por`, `reaberto_por` em `SlaOperacional`
- `src/types/database.ts` — campo `updated_by` em `LevantamentoItem`; `origem_offline` em `Vistoria`
- `src/lib/offlineQueue.ts` — `origem_offline: true` no drain de `save_vistoria`
- `docs/05-banco-de-dados.md`, `docs/07-regras-de-negocio.md`, `docs/09-divida-tecnica.md`

---

### QW-08 — Auditoria de performance PostGIS e otimizações de mapa — CONCLUÍDO

**Status:** ✅ Concluído
**Resolução:** Auditoria completa + cinco correções implementadas
**Verificado em:** 2026-07-16

**Escopo:**
Diagnóstico técnico de performance das consultas geográficas e fluxos de mapa identificou índices GIST invisíveis ao planner PostgreSQL (tipo errado), tabela `imoveis` sem índice espacial, e HeatmapLayer renderizando todos os pontos sem filtro de viewport.

#### O que foi implementado

**Correção 1+2 — Substituição de índices geometry → geography em `levantamento_itens` e `casos_notificados` (CRÍTICO):**
- Migration `20260716000000`: DROP dos índices geometry criados em `20260319240000` (que eram invisíveis ao planner porque queries usam `::geography`)
- Recriados como `GIST((ST_MakePoint(longitude, latitude)::geography))` com partial index `WHERE latitude IS NOT NULL`
- Antes: triggers `fn_cruzar_caso_com_focos` e `fn_cruzar_foco_novo_com_casos` executavam full scan a cada INSERT — O(n) por operação

**Correção 3 — Índice GIST em `imoveis` (NOVO):**
- Migration `20260716000000`: `idx_imoveis_geo` adicionado
- Otimiza `fn_vincular_imovel_automatico` que executa `ST_DWithin(30m)` em `imoveis` a cada novo foco inserido

**Correção 4 — HeatmapLayer filtra pelo viewport (FRONTEND):**
- `src/components/map-v3/HeatmapLayer.tsx`: `useMapEvents` escuta `moveend`/`zoomend`, filtra items pelo `bounds.pad(0.2)` antes de computar pontos
- Antes: renderizava todos os itens recebidos, mesmo os fora da tela

**Correção 5 — `fullDataByCliente` com limite de segurança:**
- `src/services/api.ts`: `.order('data_hora', { ascending: false }).limit(2000)` no query de levantamento_itens
- Antes: sem limite — risco de carregar histórico completo em clientes com muitos levantamentos

#### Arquivos alterados
- `supabase/migrations/20260716000000_qw08_spatial_indexes.sql` (nova migration)
- `src/components/map-v3/HeatmapLayer.tsx` — viewport filtering
- `src/services/api.ts` — limit 2000 em fullDataByCliente
- `docs/05-banco-de-dados.md` — seção de índices espaciais
- `docs/04-frontend.md` — otimizações de mapa

---

### ~~QW-09~~ — ~~Observabilidade: tornar falhas visíveis e rastreáveis~~ ✅ CONCLUÍDO

**Resolveu:** DívTec observabilidade (sem DT específico)
**Implementado em:** `20260717000000_qw09_observabilidade.sql`

**O que foi feito:**
- **Correção 1** — `api.sla.errosCriacao()` + banner de erros em `AdminSla.tsx` — erros da tabela `sla_erros_criacao` agora visíveis para o admin
- **Correção 2** — `triagem-ia-pos-voo/index.ts` — campos `status`/`erro`/`processado_em` persistidos em `levantamento_analise_ia`
- **Correção 3** — `api.offlineSyncLog.registrar()` + `offlineQueue.ts` — falhas de sync offline persistidas em `offline_sync_log`
- **Correção 4** — `relatorio-semanal/index.ts` retry 2× com backoff; `webPush.ts` + `useSlaAlerts.ts` detectam endpoint removido e notificam usuário

---

### ~~QW-10~~ — ~~Auditoria de Backup, Retenção, Recuperação e LGPD~~ ✅ CONCLUÍDO

**Resultado:** Relatório completo em `docs/QW-10-auditoria-backup-retencao-lgpd.md`

Diagnóstico de 7 áreas: backup Supabase, armazenamento Cloudinary/Storage, soft delete, cascades, LGPD, retenção de logs, exclusão segura. Identificados 5 problemas reais e 6 riscos potenciais.

---

### ~~QW-10A~~ — ~~Soft delete + proteção DELETE clientes + views filtradas~~ ✅ CONCLUÍDO

**Implementado em:** `20260718000000_qw10a_soft_delete.sql`

**O que foi feito:**
- Colunas `deleted_at` / `deleted_by` adicionadas: `focos_risco`, `casos_notificados`, `levantamento_itens`, `clientes`
- Trigger `trg_bloquear_delete_cliente` bloqueia DELETE físico em `clientes` com RAISE EXCEPTION
- Views `v_focos_risco_ativos`, `v_focos_com_casos`, `v_focos_risco_analytics`, `v_foco_risco_timeline` atualizadas com `AND fr.deleted_at IS NULL`
- `AdminClientes.tsx`: `.delete()` convertido em `.update({ ativo: false, deleted_at: now() })`
- Listagem de clientes filtra `deleted_at IS NULL`
- Tipos TypeScript atualizados: `Cliente`, `LevantamentoItem`, `CasoNotificado`, `FocoRisco`

---

### ~~QW-10B~~ — ~~Governança de arquivos, órfãos e retenção de imagens~~ ✅ CONCLUÍDO

**Implementado em:** `20260720000000_qw10b_governanca_arquivos.sql`

**Diagnóstico:** O `public_id` do Cloudinary nunca era persistido no banco. Após upload, ficava apenas em estado React ou era descartado. Ao soft-delete de qualquer registro com imagem, o arquivo no Cloudinary tornava-se órfão permanente sem possibilidade de recuperação ou limpeza.

**O que foi feito:**
- Colunas `*_public_id` adicionadas: `levantamento_itens`, `vistorias` (assinatura e foto_externa), `vistoria_calhas`, `levantamento_item_evidencias`, `operacao_evidencias`
- Tabela `cloudinary_orfaos`: fila de limpeza segura com `retention_until` (padrão 5 anos), RLS admin-only
- Trigger `trg_orfaos_levantamento_item`: popula `cloudinary_orfaos` ao setar `deleted_at` em `levantamento_itens`
- Trigger `trg_orfaos_vistoria`: captura public_ids antes de DELETE físico em `vistorias`
- RPCs `criar_levantamento_item_manual` e `denunciar_cidadao` atualizados com parâmetro `*_public_id`
- Frontend: `OperadorNovoItemManual`, `OperadorFormularioVistoria`, `DenunciaCidadao` passam `public_id` ao backend
- Edge Function `cloudinary-cleanup-orfaos`: limpeza manual com `dry_run=true` por padrão
- `api.vistorias.atualizarPublicIds()` e `api.cloudinaryOrfaos.listar()` adicionados
- Política de retenção documentada: 5 anos para evidências de saúde pública

**Auditoria:** `docs/QW-10B-governanca-arquivos-orfaos-retencao.md`

---

### QW-11 — Mover queries de `AdminSla.tsx` para `api.sla`

**Resolve:** DT-04
**Esforço:** Baixo
**Risco da mudança:** Baixo

| Dimensão | Impacto |
|----------|---------|
| Backend | `src/services/api.ts` — adicionar métodos em `api.sla` |
| Frontend | `src/pages/admin/AdminSla.tsx` — remover import direto de supabase |
| Banco | Nenhum |
| RLS | Garante que filtro de `cliente_id` é aplicado consistentemente |

**Problema que resolve:**
`AdminSla.tsx` acessa o Supabase diretamente, violando o padrão do projeto e criando um ponto cego na auditoria de multitenancy.

**Como fazer:**
1. Identificar todas as queries em `AdminSla.tsx` que usam `supabase` diretamente
2. Para cada uma, criar ou usar método existente em `api.sla`
3. Substituir as chamadas e remover `import { supabase }` do arquivo

**Dependências:** Nenhuma.
**Ordem recomendada:** Próximo sprint de segurança.

---

### QW-12 — Adicionar aviso de incompatibilidade para Web Push no iOS

**Resolve:** RO-02
**Esforço:** Baixo
**Risco da mudança:** Baixo

| Dimensão | Impacto |
|----------|---------|
| Backend | Nenhum |
| Frontend | `src/lib/webPush.ts` e componente de configuração de notificações |
| Banco | Nenhum |
| RLS | Nenhum |

**Problema que resolve:**
Agentes de campo com iPhone podem não receber alertas de SLA crítico sem saber que o recurso não funciona no browser deles.

**Como fazer:**
```typescript
// Em webPush.ts, antes de tentar subscrever:
if (!('Notification' in window) || !('serviceWorker' in navigator)) {
  console.warn('Web Push não suportado neste dispositivo');
  // Exibir toast explicativo com instrução para adicionar à tela inicial
  return null;
}
```

**Dependências:** Nenhuma.

---

### QW-13 — Documentar campos `@virtual` nos tipos TypeScript

**Resolve:** DT-07 (parcial)
**Esforço:** Baixo
**Risco da mudança:** Baixo (só documentação nos tipos)

| Dimensão | Impacto |
|----------|---------|
| Backend | `src/types/database.ts` — comentários nos campos virtuais |
| Frontend | Nenhum (muda apenas os tipos) |
| Banco | Nenhum |
| RLS | Nenhum |

**Problema que resolve:**
Novos desenvolvedores não saberão que `status_atendimento`, `acao_aplicada`, etc. não existem no banco — são reconstruídos por `enrichItensComFoco()`.

**Como fazer:**
Nos tipos de `LevantamentoItem` em `database.ts`, adicionar comentário JSDoc:
```typescript
/** @virtual Não existe na tabela levantamento_itens. Reconstruído por enrichItensComFoco() a partir de focos_risco. */
status_atendimento?: string;
```

---

## GRUPO 2 — Alta Prioridade (médio esforço, impacto crítico)

Melhorias que eliminam riscos sérios de segurança ou dados. Devem entrar nos próximos 2–4 sprints.

---

### AP-01 — Auditar pipeline Python: qual key de acesso é usada

**Resolve:** RS-01
**Esforço:** Baixo (auditoria) + Médio (se precisar corrigir)
**Risco da mudança:** Alto se a key precisar ser trocada (requer deploy do pipeline)

| Dimensão | Impacto |
|----------|---------|
| Backend | Pipeline Python — revisão da configuração de chaves |
| Frontend | Nenhum |
| Banco | Possível criação de usuário PostgreSQL com permissões limitadas |
| RLS | Diretamente — se o pipeline usa service_role, bypassa todo o RLS |

**Problema que resolve:**
O pipeline Python pode ter acesso irrestrito a dados de todas as prefeituras via `service_role key`.

**Verificação:**
```python
# No código Python, procurar por:
# SUPABASE_SERVICE_KEY ou service_role
# vs.
# SUPABASE_ANON_KEY ou anon
```

**Se usar service_role:**
1. Auditar todos os filtros de `cliente_id` no pipeline
2. Avaliar criar uma Edge Function intermediária que o pipeline chama via HTTP (a EF valida o contexto e faz a escrita)
3. Ou criar um usuário PostgreSQL dedicado com permissões apenas nas tabelas necessárias

**Dependências:** Acesso ao repositório do pipeline Python.
**Ordem recomendada:** Fazer antes do próximo onboarding de cliente.

---

### AP-02 — Implementar rate limiting no Canal Cidadão

**Resolve:** RS-02
**Esforço:** Médio
**Risco da mudança:** Baixo (adiciona proteção sem quebrar fluxo existente)

| Dimensão | Impacto |
|----------|---------|
| Backend | Edge Function ou tabela de controle |
| Frontend | `src/pages/public/DenunciaCidadao.tsx` — possível CAPTCHA |
| Banco | Tabela `canal_cidadao_rate_limit` (nova) |
| RLS | Não aplicável (usuário anônimo) |

**Problema que resolve:**
A RPC pública `canal_cidadao_denunciar` não tem nenhum controle de frequência — qualquer pessoa com o slug pode enviar milhares de denúncias falsas.

**Abordagem recomendada:**
```sql
-- Nova tabela de controle (sem dados pessoais, apenas hash do IP)
CREATE TABLE canal_cidadao_rate_limit (
  ip_hash text NOT NULL,
  slug text NOT NULL,
  contagem int NOT NULL DEFAULT 1,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash, slug)
);
```

Na RPC `canal_cidadao_denunciar`, antes de inserir:
1. Calcular hash do IP (sem armazenar o IP real — LGPD)
2. Verificar se há mais de 10 denúncias da mesma origem nos últimos 60 minutos
3. Rejeitar com erro amigável se limite atingido

**Dependências:** Nenhuma.
**Ordem recomendada:** Sprint de segurança.

---

### AP-03 — Iniciar suíte de testes: funções puras primeiro

**Resolve:** DT-10, RR-01
**Esforço:** Médio (configuração + primeiros testes)
**Risco da mudança:** Baixo (testes não afetam código de produção)

| Dimensão | Impacto |
|----------|---------|
| Backend | `src/types/sla.ts`, `src/services/api.ts` — funções a testar |
| Frontend | Nenhum (testes são arquivos separados) |
| Banco | Nenhum |
| RLS | Nenhum |

**Problema que resolve:**
Sistema de saúde pública sem nenhum teste automatizado. Qualquer mudança pode introduzir regressões silenciosas.

**Roadmap de testes (incremental):**

**Semana 1 — Configuração:**
```bash
npm install -D vitest @vitest/ui jsdom
# Adicionar ao vite.config.ts: test: { environment: 'jsdom' }
```

**Semana 2 — Funções puras (sem mock):**
```
src/types/sla.test.ts      → calcularSlaHoras(), getSlaVisualStatus()
src/lib/utils.test.ts      → normalizeScore(), formatarData()
```

**Semana 3 — Lógica de domínio:**
```
src/services/enrichItens.test.ts → enrichItensComFoco() com dados mockados
```

**Semana 4 em diante:**
Expandir para hooks usando `@testing-library/react` e `msw` para mock de Supabase.

**Dependências:** Nenhuma (pode começar hoje).
**Ordem recomendada:** Iniciar imediatamente em paralelo com outras melhorias.

---

### AP-04 — Consolidar lógica de SLA: banco é a fonte da verdade

**Resolve:** DT-05, RR-03
**Esforço:** Médio
**Risco da mudança:** Médio (mudança em módulo crítico)

| Dimensão | Impacto |
|----------|---------|
| Backend | `src/types/sla.ts` — remover cálculo redundante ou deixar apenas como preview |
| Frontend | Componentes que exibem estimativa de SLA |
| Banco | Nenhum (funções PL/pgSQL são a fonte da verdade) |
| RLS | Nenhum |

**Problema que resolve:**
`calcularSlaHoras()` em TypeScript e `sla_aplicar_fatores()` em PL/pgSQL implementam a mesma lógica independentemente. Podem divergir silenciosamente.

**Abordagem:**
1. Documentar claramente: o valor persistido em `sla_operacional.prazo_horas` é o oficial (calculado pelo banco)
2. `calcularSlaHoras()` no frontend é usado apenas para **preview** antes de salvar (ex: "este item terá SLA de aproximadamente X horas")
3. Adicionar comentário no topo de `sla.ts`: `// ATENÇÃO: esta função é apenas para preview. O SLA oficial é calculado pelo banco via sla_aplicar_fatores().`
4. Garantir que os componentes de listagem de SLA sempre leem de `sla_operacional`, nunca recalculam

**Dependências:** AP-03 (escrever testes de `calcularSlaHoras()` antes de qualquer mudança).

---

### AP-05 — Adicionar paginação nas listagens críticas

**Resolve:** RE-01
**Esforço:** Médio
**Risco da mudança:** Baixo (adiciona parâmetros opcionais às queries)

| Dimensão | Impacto |
|----------|---------|
| Backend | `api.casosNotificados.list`, `api.imoveis.list`, `api.levantamentos.list` |
| Frontend | `AdminCasosNotificados.tsx`, `OperadorListaImoveis.tsx`, `AdminLevantamentos.tsx` |
| Banco | Nenhum (Supabase suporta `.range()` nativamente) |
| RLS | Nenhum |

**Problema que resolve:**
Prefeituras com histórico extenso ou surtos ativos terão listagens com centenas/milhares de registros carregados de uma vez.

**Padrão de paginação:**
```typescript
// api.ts — adicionar parâmetros opcionais
list: async (clienteId: string, page = 0, pageSize = 50) => {
  const from = page * pageSize;
  const { data, error, count } = await supabase
    .from('casos_notificados')
    .select('*', { count: 'exact' })
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: data || [], total: count || 0 };
}
```

**Dependências:** Nenhuma. Implementar por listagem, uma de cada vez.

---

## GRUPO 3 — Média Prioridade (médio esforço, impacto moderado)

Melhorias que aumentam a manutenibilidade e eliminam ambiguidades arquiteturais.

---

### MP-01 — Resolver ambiguidade dos dois sistemas de recorrência

**Resolve:** DT-06
**Esforço:** Baixo (decisão) + Médio (migration de desativação)
**Risco da mudança:** Médio (desativar um trigger existente)

| Dimensão | Impacto |
|----------|---------|
| Backend | `api.ts` — verificar se usa `levantamento_item_recorrencia` |
| Frontend | Componentes que exibem recorrência |
| Banco | Migration para desativar trigger antigo (se decidido) |
| RLS | Nenhum |

**Problema que resolve:**
Dois sistemas rastreiam recorrência de focos: `levantamento_item_recorrencia` (trigger antigo) e `focos_risco.foco_anterior_id` (aggregate root novo). Não está claro se convivem ou se um substitui o outro.

**Decisão necessária:**
- Se `foco_anterior_id` substitui: criar migration `DROP TRIGGER trg_recorrencia_item` e documentar
- Se convivem: garantir que não se contradizem e documentar o propósito de cada um

**Dependências:** Decisão arquitetural da equipe.

---

### MP-02 — Adicionar janela de tempo ao trigger de 3 tentativas

**Resolve:** DT-11
**Esforço:** Baixo
**Risco da mudança:** Baixo

| Dimensão | Impacto |
|----------|---------|
| Backend | Nenhum |
| Frontend | Nenhum |
| Banco | Migration alterando o trigger `trg_atualizar_perfil_imovel` |
| RLS | Nenhum |

**Problema que resolve:**
Um imóvel que foi inacessível há 2 anos continua marcado como `prioridade_drone=true` indefinidamente, sem mecanismo de rebaixamento automático.

**Migration corretiva:**
```sql
-- Mudar a contagem para considerar apenas os últimos 90 dias:
SELECT COUNT(*) INTO v_tentativas
FROM vistorias
WHERE imovel_id = NEW.imovel_id
  AND acesso_realizado = false
  AND created_at >= NOW() - INTERVAL '90 days';
```

Adicionar também um trigger que limpa `prioridade_drone` quando uma vistoria bem-sucedida é registrada:
```sql
IF NEW.acesso_realizado = true THEN
  UPDATE imoveis SET prioridade_drone = false WHERE id = NEW.imovel_id;
END IF;
```

**Dependências:** Nenhuma.

---

### MP-03 — Criar função central de mapeamento de prioridade

**Resolve:** DT-08
**Esforço:** Baixo
**Risco da mudança:** Baixo

| Dimensão | Impacto |
|----------|---------|
| Backend | `src/types/sla.ts` ou novo `src/lib/prioridade.ts` |
| Frontend | Componentes que fazem a conversão manualmente |
| Banco | Nenhum |
| RLS | Nenhum |

**Problema que resolve:**
Dois sistemas de nomenclatura de prioridade coexistem: P1–P5 (SLA) e Crítica/Alta/Média/Baixa (focos). A conversão entre eles é feita em múltiplos lugares sem função central.

**Como fazer:**
```typescript
// src/lib/prioridade.ts
export const PRIORIDADE_PARA_SLA_P = {
  'Crítica':      'P1',
  'Alta':         'P3',
  'Média':        'P4',
  'Baixa':        'P5',
  'Monitoramento':'P5',
  // P2 (Urgente) é elevação dinâmica — não tem equivalente estático
} as const;

export const SLA_P_PARA_LABEL = {
  'P1': 'Crítico',
  'P2': 'Urgente',
  'P3': 'Alta',
  'P4': 'Moderada',
  'P5': 'Baixa',
} as const;
```

**Dependências:** Nenhuma.

---

### MP-04 — Criar painel de monitoramento do pipeline Python

**Resolve:** RO-01
**Esforço:** Médio
**Risco da mudança:** Baixo (adiciona funcionalidade nova)

| Dimensão | Impacto |
|----------|---------|
| Backend | Nova tabela `pipeline_runs` + possível escrita pelo pipeline Python |
| Frontend | Nova página `AdminPipelineStatus.tsx` |
| Banco | Migration para `pipeline_runs` com RLS |
| RLS | Necessária para nova tabela |

**Problema que resolve:**
Voos processados com falha no pipeline são invisíveis ao operador — ele espera itens que nunca chegam.

**Schema proposto:**
```sql
CREATE TABLE pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  levantamento_id uuid REFERENCES levantamentos(id),
  status text NOT NULL CHECK (status IN ('em_andamento', 'concluido', 'erro')),
  total_imagens int,
  imagens_processadas int,
  itens_gerados int,
  erro_mensagem text,
  iniciado_em timestamptz DEFAULT now(),
  concluido_em timestamptz,
  created_at timestamptz DEFAULT now()
);
```

**Dependências:** AP-01 (auditar pipeline Python primeiro).

---

### MP-05 — Implementar política de retenção para `levantamento_analise_ia`

**Resolve:** RE-02
**Esforço:** Baixo
**Risco da mudança:** Baixo

| Dimensão | Impacto |
|----------|---------|
| Backend | Edge Function de limpeza (ou cron SQL) |
| Frontend | Nenhum |
| Banco | Job ou trigger de limpeza periódica |
| RLS | Nenhum |

**Problema que resolve:**
A tabela de análise IA cresce indefinidamente sem nenhuma política de retenção.

**Abordagem:**
```sql
-- Executar mensalmente via pg_cron (Supabase suporta):
DELETE FROM levantamento_analise_ia
WHERE created_at < NOW() - INTERVAL '6 months'
  AND levantamento_id IN (
    SELECT id FROM levantamentos WHERE status = 'concluido'
  );
```

---

## GRUPO 4 — Melhorias Estruturais (alto esforço, impacto de longo prazo)

Refatorações que mudam a organização do código sem alterar comportamento. Devem ser feitas em sprints dedicados, não no meio de features.

---

### ME-01 — Dividir `api.ts` em módulos por domínio

**Resolve:** DT-01
**Esforço:** Alto
**Risco da mudança:** Médio (mudança estrutural, mas sem alterar interface pública)

| Dimensão | Impacto |
|----------|---------|
| Backend | `src/services/api.ts` e novo diretório `src/services/api/` |
| Frontend | Nenhum (imports via `@/services/api` continuam funcionando) |
| Banco | Nenhum |
| RLS | Nenhum |

**Estratégia incremental:**
```
src/services/
  api.ts           ← barrel de re-exportação (não muda para o resto do código)
  api/
    levantamentos.ts
    itens.ts
    focos.ts
    sla.ts
    vistorias.ts
    imoveis.ts
    casos-notificados.ts
    unidades-saude.ts
    usuarios.ts
    quotas.ts
    integracoes.ts
    cnes.ts
    admin.ts
```

**Regra:** extrair um namespace por PR. Cada extração é independente e não muda o comportamento.

**Dependências:** AP-03 (testes existentes reduzem risco de regressão).
**Ordem recomendada:** Começar pelos namespaces menos usados.

---

### ME-02 — Dividir `database.ts` em tipos por domínio

**Resolve:** DT-02
**Esforço:** Médio
**Risco da mudança:** Baixo (mudança de organização de arquivos)

| Dimensão | Impacto |
|----------|---------|
| Backend | `src/types/database.ts` → `src/types/` com múltiplos arquivos |
| Frontend | Nenhum (re-exports mantêm compat) |
| Banco | Nenhum |
| RLS | Nenhum |

**Estrutura proposta:**
```
src/types/
  database.ts         ← barrel (re-exporta tudo)
  levantamento.ts
  vistoria.ts
  focos.ts
  sla.ts
  usuarios.ts
  notificacoes.ts
  ...
```

**Dependências:** ME-01 (extrair api.ts primeiro clarifica os domínios).

---

### ME-03 — Extrair sub-componentes de `ItemDetailPanel.tsx`

**Resolve:** DT-03 (parcial)
**Esforço:** Médio
**Risco da mudança:** Médio (componente crítico, muito usado)

| Dimensão | Impacto |
|----------|---------|
| Backend | Nenhum |
| Frontend | `src/components/levantamentos/ItemDetailPanel.tsx` e novos sub-componentes |
| Banco | Nenhum |
| RLS | Nenhum |

**Sub-componentes a extrair:**
```
src/components/levantamentos/
  ItemDetailPanel.tsx           ← orquestrador (reduz para ~200 linhas)
  ItemSlaTimeline.tsx           ← timeline de auditoria de SLA
  ItemCasosProximos.tsx         ← banner + lista de casos notificados em 300m
  ItemYoloScore.tsx             ← barra de progresso + cor semântica
  ItemVozAssistente.tsx         ← comandos de voz
  ItemEsusNotificacao.tsx       ← botão + histórico e-SUS
```

**Dependências:** AP-03 (testes antes de refatorar componente crítico).

---

## GRUPO 5 — Melhorias Futuras (visão de evolução de produto)

Melhorias que requerem decisão estratégica ou que habilitam funcionalidades novas significativas.

---

### MF-01 — Migrar para NestJS + Prisma (backend dedicado)

**Resolve:** DT-01, DT-05, e a totalidade dos riscos relacionados ao `service_role key`
**Esforço:** Alto (meses)
**Risco da mudança:** Alto

**Descrição:**
Migrar a lógica de negócio para um backend NestJS com Prisma ORM, usando Supabase apenas como banco e auth. As Edge Functions seriam substituídas por endpoints REST controlados.

**Quando considerar:**
- Quando a equipe crescer e o monolito de `api.ts` se tornar insustentável
- Quando precisar de controle fino de permissões que o RLS não oferece
- Quando a complexidade das regras de negócio justificar um servidor dedicado

**Referência:** Ver `memory/project_migration_nestjs.md` para o plano detalhado (9 camadas, estimativas, riscos).

---

### MF-02 — Testes de RLS automatizados

**Resolve:** DT-10 (específico para segurança)
**Esforço:** Alto
**Risco da mudança:** Baixo

**Descrição:**
Criar uma suíte de testes que executa queries SQL como diferentes usuários e verifica que o isolamento de dados está funcionando corretamente.

**Ferramentas:** `pgTAP` (extensão PostgreSQL para testes) ou scripts em Jest/Vitest com Supabase local.

**Quando considerar:**
Após estabelecer a suíte de testes unitários (AP-03). Os testes de RLS são mais complexos e requerem ambiente de banco controlado.

---

### MF-03 — Observabilidade e logging estruturado

**Resolve:** RS-04, RO-01
**Esforço:** Alto
**Risco da mudança:** Baixo

**Descrição:**
Implementar logging estruturado em todas as Edge Functions e no pipeline Python, enviando para uma ferramenta de observabilidade (ex: Grafana, Datadog, ou até uma tabela PostgreSQL de auditoria).

**Quando considerar:**
Quando o número de prefeituras crescer e problemas em campo ficarem difíceis de diagnosticar remotamente.

---

## Tabela-resumo por prioridade

| ID | Melhoria | Grupo | Esforço | Risco | Dependências |
|----|----------|-------|---------|-------|--------------|
| QW-01 | Remover usuário dev de produção | Quick Win | Baixo | Baixo | Nenhuma |
| QW-02 | Verificar RLS em tabelas suspeitas | Quick Win | Baixo | Baixo/Médio | Nenhuma |
| ~~QW-03~~ | ~~Corrigir sobrescrita payload surto~~ | Quick Win | — | — | ✅ Resolvido historicamente |
| ~~QW-04~~ | ~~Auditoria completa RLS e security_invoker~~ | Quick Win | — | — | ✅ Resolvido historicamente |
| ~~QW-05~~ | ~~Correções sync offline (idempotência + evidências)~~ | Quick Win | — | — | ✅ Concluído |
| ~~QW-06~~ | ~~Auditoria e correções SLA automático~~ | Quick Win | — | — | ✅ Concluído |
| ~~QW-07~~ | ~~Rastreabilidade mínima operacional~~ | Quick Win | — | — | ✅ Concluído |
| ~~QW-08~~ | ~~Auditoria PostGIS + índices GIST + viewport filtering~~ | Quick Win | — | — | ✅ Concluído |
| ~~QW-09~~ | ~~Observabilidade: erros SLA visíveis, triagem IA rastreável, offline_sync_log, push alert~~ | Quick Win | — | — | ✅ Concluído |
| ~~QW-10~~ | ~~Auditoria backup, retenção, recuperação e LGPD~~ | Quick Win | — | — | ✅ Concluído (diagnóstico) |
| ~~QW-10A~~ | ~~Soft delete + bloqueio DELETE clientes + views filtradas~~ | Quick Win | — | — | ✅ Concluído |
| ~~QW-10B~~ | ~~Governança de arquivos: public_id, cloudinary_orfaos, triggers, retention policy~~ | Quick Win | — | — | ✅ Concluído |
| QW-11 | Mover queries AdminSla para api.sla | Quick Win | Baixo | Baixo | Nenhuma |
| QW-12 | Aviso Web Push iOS | Quick Win | Baixo | Baixo | Nenhuma |
| QW-13 | Documentar campos @virtual | Quick Win | Baixo | Baixo | Nenhuma |
| AP-01 | Auditar pipeline Python | Alta Prioridade | Baixo+Médio | Alto | Acesso ao repo Python |
| AP-02 | Rate limiting Canal Cidadão | Alta Prioridade | Médio | Baixo | Nenhuma |
| AP-03 | Iniciar suíte de testes | Alta Prioridade | Médio | Baixo | Nenhuma |
| AP-04 | Consolidar lógica SLA | Alta Prioridade | Médio | Médio | AP-03 |
| AP-05 | Paginação nas listagens | Alta Prioridade | Médio | Baixo | Nenhuma |
| MP-01 | Resolver ambiguidade recorrência | Média Prioridade | Baixo+Médio | Médio | Decisão arquitetural |
| MP-02 | Janela de tempo no trigger | Média Prioridade | Baixo | Baixo | Nenhuma |
| MP-03 | Função central de prioridade | Média Prioridade | Baixo | Baixo | Nenhuma |
| MP-04 | Painel monitoramento pipeline | Média Prioridade | Médio | Baixo | AP-01 |
| MP-05 | Retenção levantamento_analise_ia | Média Prioridade | Baixo | Baixo | Nenhuma |
| ME-01 | Dividir api.ts | Estrutural | Alto | Médio | AP-03 |
| ME-02 | Dividir database.ts | Estrutural | Médio | Baixo | ME-01 |
| ME-03 | Extrair sub-componentes ItemDetailPanel | Estrutural | Médio | Médio | AP-03 |
| MF-01 | Migrar para NestJS + Prisma | Futuro | Alto | Alto | ME-01, AP-03 |
| MF-02 | Testes de RLS automatizados | Futuro | Alto | Baixo | AP-03 |
| MF-03 | Observabilidade e logging | Futuro | Alto | Baixo | MP-04 |

---

*Documento baseado no código-fonte real. Versão 2.1.0, análise em 2026-03-26.*
