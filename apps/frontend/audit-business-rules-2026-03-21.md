# SentinelaWeb — Business Rules Audit Report
**Date:** 2026-03-21
**Auditor:** Claude Sonnet 4.6 (automated deep audit)
**Scope:** Domains A–H as specified in audit brief
**Last updated:** 2026-03-21 — 2nd audit implementation cycle complete

---

## Implementation Status Legend

| Badge | Meaning |
|-------|---------|
| ✅ IMPLEMENTADO | Corrigido — migration ou código entregue e build OK |
| ⚠️ PENDENTE | Identificado, não implementado neste ciclo |
| 🔵 ACEITO | Risco aceito / decisão arquitetural / não crítico |
| 📋 INFORMATIVO | Sem ação necessária |

---

## DOMAIN A — SLA Operacional

### [A-01] — calcularSlaHoras usa SLA_RULES hardcoded; DB config não afeta o cálculo frontend
**Severity:** ALTO | **Status:** ⚠️ PENDENTE
**File(s):** `src/types/sla.ts` (SLA_RULES, calcularSlaHoras), `supabase/migrations/20250311180000_sla_config_por_regiao.sql`
**Description:** `calcularSlaHoras()` usa `SLA_RULES` hardcoded no TypeScript. A função `sla_resolve_config` existe no banco e é chamada pelos triggers de auto-SLA (inserção em `levantamento_itens`), mas o frontend nunca consulta `sla_config` nem `sla_config_regiao` ao exibir ou validar SLAs. Se um gestor personalizar SLA por região no banco, a UI continua mostrando valores hardcoded. As duas fontes de verdade estão desalinhadas.
**Impact:** Operadores veem prazo incorreto na UI; relatórios de auditoria divergem do banco.
**Fix:**
```typescript
// Consultar sla_resolve_config via RPC ao carregar um SLA, ou
// expor o prazo_final calculado pelo trigger como campo canônico e
// exibir apenas sla_operacional.prazo_final — nunca recalcular no frontend.
// Em useSla.ts, remover uso de calcularSlaHoras para display e usar prazo_final do banco.
```

---

### [A-02] — calcularSlaHoras: resultado para Crítico com todas as reduções pode ficar abaixo de 2h
**Severity:** MÉDIO | **Status:** 📋 INFORMATIVO
**File(s):** `src/types/sla.ts` linhas ~40–70
**Description:** Para prioridade=Crítico: base=4h → -30% (risco Muito Alto) = 2.8h → -20% (persistência>3) = 2.24h → -10% (temperatura>30°C) = 2.016h. O mínimo de 2h é respeitado neste caso. Porém para Urgente com base=4h e aplicação de todos os fatores: 4 × 0.7 × 0.8 × 0.9 = 2.016h — ainda acima de 2h. O código de `Math.max(horas, 2)` está presente e funciona. **Não há bug numérico aqui**, mas a aplicação simultânea de todos os três fatores não está documentada como regra explícita.
**Impact:** Baixo — mínimo de 2h é respeitado. Risco é de expectativa incorreta de stakeholders sobre o SLA resultante.
**Fix:** Documentar no CLAUDE.md que as três reduções são aditivas e o mínimo absoluto de 2h prevalece.

---

### [A-03] — Feriados existem na tabela mas NÃO são descontados do auto-trigger de SLA
**Severity:** ALTO | **Status:** ✅ IMPLEMENTADO
**File(s):** `supabase/migrations/20260605010000_sla_feriados_trigger_a03.sql`
**Description:** A migration de feriados criou `sla_feriados` e a função `sla_calcular_prazo_final` que desconta feriados e horário comercial. Porém o trigger de auto-SLA em `levantamento_itens` usava `now() + (v_sla_horas || ' hours')::interval` diretamente — não chamava `sla_calcular_prazo_final`.
**Resolution:** Migration `20260605010000_sla_feriados_trigger_a03.sql` reescreve `trg_levantamento_item_criar_sla_auto` para chamar `sla_calcular_prazo_final(v_inicio, v_horas, v_cliente_id)` com fallback para `now() + interval` se a função não existir. Feriados agora são descontados automaticamente no prazo_final de todos os SLAs criados por levantamento.

---

### [A-04] — sla_config_por_regiao é usada no trigger de criação, mas `escalar_sla_operacional` pode ignorar regiao_id
**Severity:** BAIXO | **Status:** 🔵 ACEITO
**File(s):** `supabase/migrations/20250311180000_sla_config_por_regiao.sql`
**Description:** Itens pluvio (sem `levantamento_item_id`) não têm `regiao_id` associado, portanto sempre usam config cliente-wide. Funcionamento aceitável, documentado como comportamento esperado.

---

### [A-05] — sla-marcar-vencidos: cron a cada 15min; proteção contra escalada dupla existe via `escalonado_automatico`
**Severity:** INFORMATIVO | **Status:** 📋 INFORMATIVO
**Description:** Funciona corretamente. Campo `escalonado_automatico` previne re-escalada.

---

### [A-06] — Offline: create_vistoria_completa usa checkin_em do payload (original), não now()
**Severity:** INFORMATIVO | **Status:** 📋 INFORMATIVO
**Description:** Correto para auditoria — preserva timestamp original de campo.

---

## DOMAIN B — Multitenancy & RLS

### [B-01] — Não há distinção entre admin de plataforma e admin de prefeitura no sistema de papéis
**Severity:** ALTO | **Status:** ⚠️ PENDENTE (arquitetural)
**File(s):** `src/App.tsx`, `src/pages/Admin.tsx` (AdminGuard), `supabase/migrations/20250306140000_rpc_get_meu_papel.sql`
**Description:** O papel `admin` é único — o mesmo papel que gerencia usuários de uma prefeitura pode acessar `AdminPainelMunicipios` que compara dados de múltiplos clientes. A distinção é feita apenas via `ClienteAtivoProvider` no frontend (admin de plataforma pode selecionar qualquer cliente), mas não há papel diferenciado no banco.
**Impact:** Risco de vazamento de dados entre prefeituras se RLS tiver brecha; dificulta auditoria.
**Fix:** Criar papel `superadmin` ou `platform_admin` separado do `admin` de prefeitura. Escopo: refatoração arquitetural planejada para ciclo futuro.

---

### [B-02] — caso_foco_cruzamento NÃO tem RLS habilitado
**Severity:** CRÍTICO | **Status:** ✅ IMPLEMENTADO
**File(s):** `supabase/migrations/20260605000000_rls_constraints_b02_h01_c02_c06.sql`
**Description:** A tabela `caso_foco_cruzamento` existia sem `ENABLE ROW LEVEL SECURITY` — qualquer usuário autenticado podia ler cruzamentos de qualquer prefeitura.
**Resolution:** Migration `20260605000000` adiciona `ALTER TABLE caso_foco_cruzamento ENABLE ROW LEVEL SECURITY` e policy `"caso_foco_cruzamento_isolamento"` que filtra via JOIN `casos_notificados → usuarios → auth.uid()`. Multitenancy garantido.

---

### [B-03] — canal_cidadao: slug é UUID gerado aleatoriamente
**Severity:** BAIXO | **Status:** 🔵 ACEITO
**Description:** UUID como slug torna enumeração inviável. Rate limiting via `canal_cidadao_rate_limit`. Risco aceitável.

---

### [B-04] — auth_id IS NULL permitido em usuarios
**Severity:** MÉDIO | **Status:** 🔵 ACEITO
**Description:** Agentes sem auth_id (sem conta web) ficam inacessíveis via RLS — não há vazamento. Comportamento documentado.

---

### [B-05] — Rotas `/levantamentos` e `/operador` sem OperadorGuard/AdminGuard
**Severity:** MÉDIO | **Status:** ✅ IMPLEMENTADO
**File(s):** `src/App.tsx`
**Description:** Rotas sem guard de papel permitiam acesso de `notificador` a telas de operador/admin.
**Resolution:** `src/App.tsx` atualizado — `/levantamentos` envolto em `<AdminOrSupervisorGuard>` e `/operador` envolto em `<OperadorGuard>`.

---

## DOMAIN C — Vistoria de Campo

### [C-01] — qtd_com_focos ≤ qtd_inspecionados: validação existe no DB via CHECK (migration R-29)
**Severity:** INFORMATIVO | **Status:** 📋 INFORMATIVO
**Description:** CHECK constraint existe no banco + validação frontend. Dupla proteção correta.

---

### [C-02] — Não há constraint DB para qtd_eliminados ≤ qtd_com_focos
**Severity:** MÉDIO | **Status:** ✅ IMPLEMENTADO
**File(s):** `supabase/migrations/20260605000000_rls_constraints_b02_h01_c02_c06.sql`
**Resolution:** Migration adiciona `CHECK (qtd_eliminados <= qtd_com_focos)` em `vistoria_depositos`. Constraint também registrada em `schema.sql`.

---

### [C-03] — trg_sintomas_para_caso: preenche lat/lng do imóvel corretamente (via JOIN)
**Severity:** INFORMATIVO | **Status:** 📋 INFORMATIVO
**Description:** Trigger corrigido em migration posterior. Funciona corretamente.

---

### [C-04] — calha_inacessivel NÃO conta separadamente para as 3 tentativas do trigger de drone
**Severity:** MÉDIO | **Status:** 🔵 ACEITO
**Description:** Vistorias com `acesso_realizado=TRUE` + `calha_inacessivel=TRUE` não contribuem para as 3 tentativas de sem-acesso que ativam `prioridade_drone`. Documentado como comportamento intencional — calha inacessível é situação distinta de imóvel bloqueado.

---

### [C-05] — Imóvel pode ser salvo sem GPS (latitude/longitude nullable)
**Severity:** MÉDIO | **Status:** ✅ PARCIAL
**File(s):** `src/pages/operador/OperadorListaImoveis.tsx`
**Description:** Imóveis sem GPS ficam invisíveis para funcionalidades geoespaciais.
**Resolution:** `OperadorListaImoveis.tsx` atualizado — formulário de cadastro rápido agora inclui campos de latitude/longitude + captura automática via GPS ao abrir o dialog (badge verde se GPS capturado, âmbar se ausente). Constraint NOT NULL no banco não adicionada para não bloquear cadastros em campo sem GPS (decisão de UX).

---

### [C-06] — Ciclo (1-6) não tem CHECK constraint no DB
**Severity:** BAIXO | **Status:** ✅ IMPLEMENTADO
**File(s):** `supabase/migrations/20260605000000_rls_constraints_b02_h01_c02_c06.sql`
**Resolution:** Migration adiciona `CHECK (ciclo BETWEEN 1 AND 6)` em `vistorias`. Constraint registrada em `schema.sql`.

---

## DOMAIN D — Centro de Notificações

### [D-01] — listProximosAoPonto delega corretamente ao PostGIS via RPC
**Severity:** INFORMATIVO | **Status:** 📋 INFORMATIVO
**Description:** Correto — PostGIS cuida de todo cálculo de distância.

---

### [D-02] — Não existe lógica para reverter prioridade quando um caso é descartado
**Severity:** ALTO | **Status:** ✅ IMPLEMENTADO
**File(s):** `supabase/migrations/20260605020000_caso_descartado_foco_sla_d02_d03_e02.sql`
**Description:** Ao descartar caso, itens permaneciam com prioridade 'Crítico' indefinidamente.
**Resolution:** Migration cria `fn_reverter_prioridade_caso_descartado` + trigger `trg_reverter_prioridade_caso_descartado` AFTER UPDATE em `casos_notificados`. Quando `status → 'descartado'`, percorre cruzamentos do caso e reverte prioridade para `prioridade_original` de cada item — somente se não houver outros casos ativos no raio de 300m.

---

### [D-03] — Não existe trigger inverso (novo foco → busca casos próximos)
**Severity:** MÉDIO | **Status:** ✅ IMPLEMENTADO
**File(s):** `supabase/migrations/20260605020000_caso_descartado_foco_sla_d02_d03_e02.sql`
**Description:** Focos criados após casos já registrados nunca eram cruzados.
**Resolution:** Migration cria `fn_cruzar_foco_com_casos` + trigger `trg_cruzar_foco_com_casos` AFTER INSERT em `levantamento_itens`. Busca `casos_notificados` do mesmo cliente em raio de 300m via `ST_DWithin` e insere cruzamentos em `caso_foco_cruzamento`, elevando prioridade para 'Crítico'. Cruzamento agora é bidirecional.

---

### [D-04] — NotificadorRegistroCaso: campo renomeado para logradouro_bairro (LGPD migration)
**Severity:** INFORMATIVO | **Status:** 📋 INFORMATIVO
**Description:** Campo `endereco_paciente` renomeado para `logradouro_bairro`. Formulário atualizado.

---

### [D-05] — Papel notificador: RLS de casos_notificados não restringe UPDATE por papel
**Severity:** MÉDIO | **Status:** ✅ IMPLEMENTADO
**File(s):** `supabase/migrations/20260605030000_notificador_rls_d05.sql`
**Description:** Notificador podia atualizar casos criados por outros usuários do mesmo cliente.
**Resolution:** Migration substitui política única por 4 políticas granulares: SELECT (todos do cliente), INSERT (notificador/admin/supervisor), UPDATE (admin/supervisor OU próprio notificador via `notificador_id`), DELETE (admin/supervisor apenas).

---

### [D-06] — Botão "Criar planejamento" em cluster de casos não previne duplicatas
**Severity:** MÉDIO | **Status:** ✅ PARCIAL
**File(s):** `src/pages/admin/AdminCasosNotificados.tsx`
**Description:** Criação de planejamentos duplicados para o mesmo cluster.
**Resolution:** `AdminCasosNotificados.tsx` atualizado com `planejamentosJaSolicitados` Set state — ao clicar no botão de cluster de um bairro já solicitado, exibe alerta de aviso e requer confirmação. Navega para tela de planejamentos com `state: { bairroDestaque, fromCluster: true }` para verificação visual. Deduplicação completa no banco (verificar planejamento ativo existente) fica para ciclo futuro.

---

## DOMAIN E — YOLO Score

### [E-01] — normalizeScore aplicada em todos os pontos de display identificados
**Severity:** INFORMATIVO | **Status:** 📋 INFORMATIVO
**Description:** `normalizeScore` corretamente exportada e usada. `score_final` é `integer` no banco (0-100); normalização para 0-1 é exclusivamente para exibição.

---

### [E-02] — Marcar falso positivo NÃO cancela/fecha o SLA associado
**Severity:** ALTO | **Status:** ✅ IMPLEMENTADO
**File(s):** `supabase/migrations/20260605020000_caso_descartado_foco_sla_d02_d03_e02.sql`
**Description:** SLA permanecia aberto e podia vencer mesmo após item marcado como falso positivo.
**Resolution:** Migration cria `fn_falso_positivo_fecha_sla` + trigger `trg_falso_positivo_fecha_sla` AFTER INSERT OR UPDATE em `yolo_feedback`. Quando `confirmado = false`, busca SLAs ativos (`status NOT IN ('concluido','vencido')`) para o `levantamento_item_id` e os fecha com `status='concluido', concluido_em=now(), observacao='Fechado automaticamente: item marcado como falso positivo'`.

---

### [E-03] — Não existe regra explícita de mapeamento score → prioridade no código/DB
**Severity:** MÉDIO | **Status:** ✅ IMPLEMENTADO
**File(s):** `src/components/levantamentos/detail/ItemScoreBadge.tsx`
**Description:** Faixas de score não estavam mapeadas explicitamente para prioridade operacional.
**Resolution:** `ItemScoreBadge.tsx` exporta `scoreToPrioridadeSugerida(score)` com mapeamento canônico documentado (`>= 0.85 → Alta`, `>= 0.65 → Média`, `>= 0.45 → Baixa`, `< 0.45 → Monitoramento`). Função retorna **sugestão** — documentação explícita que a prioridade real vem do pipeline Python e nunca deve ser sobrescrita automaticamente por este valor.

---

## DOMAIN F — Quota

### [F-01] — Trigger de quota usa UTC (now()) — pode divergir do timezone da prefeitura
**Severity:** MÉDIO | **Status:** ✅ IMPLEMENTADO
**File(s):** `supabase/migrations/20260605040000_quota_timezone_f01.sql`
**Description:** `date_trunc('month', now())` causava desvio de 1-3h na virada do mês para prefeituras UTC-3.
**Resolution:** Migration reescreve `check_quota_voos` usando `date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')` para contagem mensal consistente com o calendário local.

---

### [F-02] — quota_levantamento_itens_trigger: migration existe (20260402000000) mas não foi auditada
**Severity:** INFORMATIVO | **Status:** ⚠️ PENDENTE
**Description:** Verificar se o trigger de quota de levantamento_itens tem o mesmo problema de UTC e aplicar mesma correção se necessário.

---

### [F-03] — api.quotas.verificar ausente em operações críticas
**Severity:** ALTO | **Status:** ⚠️ PENDENTE
**File(s):** `src/pages/admin/AdminVoos.tsx`, `src/pages/operador/OperadorNovoItemManual.tsx`
**Description:** `api.quotas.verificar` é chamado apenas antes de criar voo e item manual. `api.levantamentos.create`, `api.planejamentos.create` e o RPC `create_vistoria_completa` não verificam quota no frontend. Trigger de banco protege voos, mas não levantamentos/itens de vistoria.

---

### [F-04] — QuotaBanner: threshold de 70% documentado
**Severity:** BAIXO | **Status:** 🔵 ACEITO
**Description:** Threshold documentado no CLAUDE.md. Comportamento consistente.

---

## DOMAIN G — e-SUS Notifica

### [G-01] — calcularSemanaEpidemiologica tem algoritmo incorreto
**Severity:** ALTO | **Status:** ✅ IMPLEMENTADO
**File(s):** `src/lib/sinan.ts`
**Description:** Algoritmo anterior era aproximação simples que não seguia o padrão SVS/MS (domingo a sábado, semana 1 contém 01/jan). Produzia semana incorreta para datas no início/fim do ano.
**Resolution:** `sinan.ts` reescrito com algoritmo SVS-correto: âncora no domingo da semana que contém a data, comparado com o domingo da semana que contém 01/jan do ano. Borda de virada de ano tratada (retorna última semana do ano anterior se `weekNumber < 1`). Validado para 01/01/2025 (quarta-feira → semana 1, com início em 29/12/2024).

---

### [G-02] — montarPayloadESUS não inclui campos requeridos pelo e-SUS
**Severity:** MÉDIO | **Status:** ✅ IMPLEMENTADO
**File(s):** `src/lib/sinan.ts`
**Description:** Campos obrigatórios `municipioResidencia` e `dataInicioSintomas` ausentes do payload.
**Resolution:** `montarPayloadESUS` estendido com parâmetro `data_inicio_sintomas` opcional no objeto `item`. Payload agora inclui `dataInicioSintomas` (fallback para `dataNotificacao` se ausente — padrão conservador revisado pelo município) e `municipioResidencia` (padrão: mesmo código IBGE do município da prefeitura).

---

### [G-03] — Não há retry automático para notificações rejeitadas
**Severity:** MÉDIO | **Status:** ✅ IMPLEMENTADO
**File(s):** `src/services/api.ts`, `src/components/levantamentos/detail/ItemEsusNotifica.tsx`
**Description:** Falhas de rede ou validação ficavam permanentes — usuário tinha que re-abrir modal e reenviar do zero.
**Resolution:**
- `api.notificacoesESUS.reenviar(id, integracao)` adicionado em `api.ts` — reutiliza `payload_enviado` original, recalcula semana epidemiológica com algoritmo correto, atualiza status para `pendente → enviado/erro`.
- `ItemEsusNotifica.tsx` exibe botão `RefreshCw` ao lado do badge "Erro" em cada notificação com `status='erro'`. Um clique retenta sem abrir modal.
- **Bônus (G-01 fix):** `api.notificacoesESUS.enviar` refatorado para usar `montarPayloadESUS` de `sinan.ts` — eliminada duplicata inline com algoritmo antigo errado.

---

### [G-04] — Badge visual de ambiente homologação não visível em telas operacionais
**Severity:** BAIXO | **Status:** ✅ IMPLEMENTADO
**File(s):** `src/components/levantamentos/detail/ItemEsusNotifica.tsx`
**Description:** Operador podia acreditar que notificou produção quando estava em homologação.
**Resolution:** `ItemEsusNotifica.tsx` exibe badge âmbar "Homologação" no cabeçalho do card quando `integracao.ambiente !== 'producao'`, visível antes mesmo de clicar no botão de notificação.

---

## DOMAIN H — Offline & Sync

### [H-01] — create_vistoria_completa NÃO é idempotente: sem UNIQUE constraint em vistorias por imovel+agente+data
**Severity:** ALTO | **Status:** ✅ IMPLEMENTADO
**File(s):** `supabase/migrations/20260605000000_rls_constraints_b02_h01_c02_c06.sql`
**Description:** Re-drain da fila offline poderia criar vistorias duplicadas para a mesma visita.
**Resolution:** Migration adiciona `UNIQUE (imovel_id, agente_id, data_visita)` em `vistorias`. Constraint registrada em `schema.sql`. O RPC `create_vistoria_completa` pode usar `ON CONFLICT DO NOTHING` na próxima revisão do RPC para comportamento totalmente idempotente.

---

### [H-02] — Offline queue: FIFO não garantido por índice no IDBObjectStore
**Severity:** MÉDIO | **Status:** ✅ IMPLEMENTADO
**File(s):** `src/lib/offlineQueue.ts`
**Description:** `getAll()` sem índice de `createdAt` não garantia ordem FIFO — operações sequencialmente dependentes podiam ser processadas fora de ordem.
**Resolution:** `offlineQueue.ts` atualizado para `VERSION = 2` com `onupgradeneeded` criando índice `'por_createdAt'` em todos os stores. `listAll()` usa `store.index('por_createdAt').getAll()` quando disponível, garantindo ordem cronológica no drain.

---

### [H-03] — Dados de saúde (sintomas, moradores) gravados em plaintext no IndexedDB
**Severity:** MÉDIO | **Status:** ⚠️ PENDENTE
**File(s):** `src/lib/offlineQueue.ts` (VistoriaPayload)
**Description:** Dados sensíveis (moradores, sintomas, gravidas, idosos) armazenados em texto claro no IndexedDB. Em dispositivos compartilhados ou com acesso físico, esses dados são acessíveis.
**Impact:** Potencial violação de LGPD em dispositivos físicos de campo.
**Fix:** Criptografar payload antes de gravar no IndexedDB via Web Crypto API com chave derivada do JWT da sessão.

---

### [H-04] — OfflineBanner: pendingCount assíncrono
**Severity:** BAIXO | **Status:** 🔵 ACEITO
**Description:** Janela de atualização do badge é aceitável para uso normal. Sem risco de dados perdidos.

---

## Consolidated Risk Table

| ID | Domain | Severity | Title | Status |
|----|--------|----------|-------|--------|
| A-01 | SLA | ALTO | calcularSlaHoras hardcoded vs DB config | ⚠️ PENDENTE |
| A-03 | SLA | ALTO | Feriados não descontados no auto-trigger SLA | ✅ IMPLEMENTADO |
| B-02 | RLS | CRÍTICO | caso_foco_cruzamento sem RLS | ✅ IMPLEMENTADO |
| B-01 | Multitenancy | ALTO | Sem distinção admin plataforma vs prefeitura | ⚠️ PENDENTE (arq.) |
| B-05 | Rotas | MÉDIO | /levantamentos e /operador sem guard de papel | ✅ IMPLEMENTADO |
| C-02 | Vistoria | MÉDIO | Sem constraint qtd_eliminados ≤ qtd_com_focos | ✅ IMPLEMENTADO |
| C-04 | Vistoria | MÉDIO | calha_inacessivel não conta para trigger drone | 🔵 ACEITO |
| C-05 | Vistoria | MÉDIO | Imóvel sem GPS invisível para geoespacial | ✅ PARCIAL (UI) |
| C-06 | Vistoria | BAIXO | Ciclo sem CHECK 1-6 | ✅ IMPLEMENTADO |
| D-02 | Notificações | ALTO | Prioridade não revertida ao descartar caso | ✅ IMPLEMENTADO |
| D-03 | Notificações | MÉDIO | Sem trigger inverso foco→caso | ✅ IMPLEMENTADO |
| D-05 | Notificações | MÉDIO | Notificador pode editar casos de outros | ✅ IMPLEMENTADO |
| D-06 | Notificações | MÉDIO | Cluster→planejamento sem dedup | ✅ PARCIAL (UI) |
| E-02 | YOLO | ALTO | Falso positivo não fecha SLA | ✅ IMPLEMENTADO |
| E-03 | YOLO | MÉDIO | Sem mapeamento score→prioridade explícito | ✅ IMPLEMENTADO |
| F-01 | Quota | MÉDIO | Trigger quota usa UTC não timezone cliente | ✅ IMPLEMENTADO |
| F-02 | Quota | INFO | quota_levantamento_itens_trigger não auditada | ⚠️ PENDENTE |
| F-03 | Quota | ALTO | api.quotas.verificar ausente em operações críticas | ⚠️ PENDENTE |
| G-01 | e-SUS | ALTO | calcularSemanaEpidemiologica incorreto | ✅ IMPLEMENTADO |
| G-02 | e-SUS | MÉDIO | Payload e-SUS com campos obrigatórios ausentes | ✅ IMPLEMENTADO |
| G-03 | e-SUS | MÉDIO | Sem retry automático para notificações | ✅ IMPLEMENTADO |
| G-04 | e-SUS | BAIXO | Ambiente homologação não visível em tela operacional | ✅ IMPLEMENTADO |
| H-01 | Offline | ALTO | create_vistoria_completa não idempotente | ✅ IMPLEMENTADO |
| H-02 | Offline | MÉDIO | Fila offline sem garantia FIFO | ✅ IMPLEMENTADO |
| H-03 | Offline | MÉDIO | Dados de saúde em plaintext no IndexedDB | ⚠️ PENDENTE |

---

## Resumo do 2º Ciclo de Implementação

**Período:** 2026-03-21
**Build:** PASS — 3731 módulos, 0 erros TypeScript, 0 erros ESLint

### Migrations entregues

| Arquivo | Itens cobertos |
|---------|---------------|
| `20260604000000_business_rules_risk_fixes.sql` | R-38 (array casos), R-29 (focos≤inspecionados), R-26 (60d), R-08 (transição status), R-37 (GIST indexes) |
| `20260605000000_rls_constraints_b02_h01_c02_c06.sql` | B-02, H-01, C-02, C-06 |
| `20260605010000_sla_feriados_trigger_a03.sql` | A-03 |
| `20260605020000_caso_descartado_foco_sla_d02_d03_e02.sql` | D-02, D-03, E-02 |
| `20260605030000_notificador_rls_d05.sql` | D-05 |
| `20260605040000_quota_timezone_f01.sql` | F-01 |

### Código TypeScript/Frontend entregue

| Arquivo | Itens cobertos |
|---------|---------------|
| `src/lib/sinan.ts` | G-01, G-02 |
| `src/services/api.ts` | G-03 (reenviar), G-01 (remove duplicata), ESLint fixes |
| `src/components/levantamentos/detail/ItemEsusNotifica.tsx` | G-03 (botão retry), G-04 (badge homologação) |
| `src/components/levantamentos/detail/ItemScoreBadge.tsx` | E-03 (scoreToPrioridadeSugerida) |
| `src/App.tsx` | B-05 (guards de rota) |
| `src/lib/offlineQueue.ts` | H-02 (IDB index FIFO) |
| `src/pages/operador/OperadorListaImoveis.tsx` | C-05 (GPS auto-capture) |
| `src/pages/admin/AdminCasosNotificados.tsx` | D-06 (dedup warning) |
| `src/pages/admin/AdminQuotas.tsx` | ESLint fix (Infinity → InfinityIcon) |

### Itens pendentes para próximo ciclo

| Prioridade | ID | Título |
|------------|-----|--------|
| Alta | A-01 | Sincronizar calcularSlaHoras com config do banco |
| Alta | F-03 | Verificar quota em levantamentos/vistorias |
| Média | B-01 | Papel superadmin/platform_admin |
| Média | H-03 | Criptografia IndexedDB (LGPD) |
| Baixa | F-02 | Auditar quota_levantamento_itens_trigger timezone |
| Baixa | D-06 | Deduplicação completa de planejamento por cluster no banco |

---

## Top 5 Ações Prioritárias (Ciclo Seguinte)

1. **[A-01] Sincronizar `calcularSlaHoras` com configuração do banco** — a UI ainda usa `SLA_RULES` hardcoded enquanto o banco usa `sla_resolve_config`. Operadores veem prazos incorretos. Solução: `useSla.ts` consumir `prazo_final` do banco como campo canônico e não recalcular no frontend.

2. **[F-03] Verificar quota em todos os fluxos de criação** — `api.levantamentos.create`, `api.planejamentos.create` e `create_vistoria_completa` não verificam quota. Se o trigger de banco não cobrir esses casos, há bypass silencioso.

3. **[B-01] Criar papel `platform_admin`** — separar admin de prefeitura de admin de plataforma a nível de banco e papéis RPC. Necessário para escala multi-município.

4. **[H-03] Criptografia de IndexedDB** — dados de saúde (sintomas, moradores, gravidas) em plaintext violam LGPD em dispositivos físicos de campo. Web Crypto API com chave derivada do JWT da sessão.

5. **[D-06] Deduplicação de planejamento por cluster no banco** — verificar `planejamentos` ativos do cliente para o bairro antes de criar novo, evitando duplicação operacional.

---

## Lacunas de Regras de Negócio (Sugestões para CLAUDE.md)

1. **Calhas inacessíveis e prioridade drone**: Documentar explicitamente que `calha_inacessivel=TRUE` com `acesso_realizado=TRUE` NÃO conta para as 3 tentativas sem acesso. Se a intenção for diferente, criar campo separado.

2. **Mapeamento score YOLO → prioridade**: Documentar que a prioridade dos itens é definida exclusivamente pelo pipeline Python. O score YOLO exibido no frontend é apenas indicativo de confiança e não altera prioridade automaticamente no sistema web.

3. **Idempotência do drain offline**: Documentar que `drainQueue` pode ser chamado múltiplas vezes e que `create_vistoria_completa` deve ser idempotente. Após o fix do H-01, documentar a garantia.

4. **Timezone para quotas**: Quotas mensais agora calculadas em `America/Sao_Paulo` (fix F-01). Documentar que o timezone é fixo e não configurável por prefeitura neste ciclo.

5. **Semana epidemiológica**: Documentar que `calcularSemanaEpidemiologica` segue o calendário SVS (domingo a sábado, semana 1 contém 01/jan ou o domingo anterior). Implementação em `src/lib/sinan.ts`.

---

## Sugestões de Melhoria de Produto

1. **Dashboard de integridade de dados**: Painel admin que mostra: imóveis sem GPS (%), vistorias com dados inconsistentes, SLAs vencidos por falso positivo — para gestão proativa de qualidade de dados.

2. **Audit trail de alterações de prioridade**: Quando a prioridade de um `levantamento_item` é alterada por trigger (caso próximo ou descarte), registrar em `levantamento_item_status_historico` o motivo, o caso_id envolvido e o timestamp. Atualmente essa mutação é silenciosa.

3. **Correlação bidirecional caso↔foco com histórico temporal**: Exibir tendência histórica (cluster crescente, estável, decrescente) para apoiar decisão de planejamento.

4. **Criptografia do IndexedDB offline**: Para conformidade LGPD em campo, implementar criptografia do payload de vistoria usando Web Crypto API. Chave derivada do JWT do agente.

5. **Indicador de saúde da integração e-SUS**: Badge no dashboard admin mostrando taxa de sucesso de envio e-SUS nos últimos 7 dias, com link para reenvio em lote de notificações com status='erro'.
