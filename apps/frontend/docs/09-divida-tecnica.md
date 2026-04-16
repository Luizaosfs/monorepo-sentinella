# 09 — Dívida Técnica

## Objetivo deste documento

Identificar, catalogar e priorizar toda a dívida técnica do projeto: código legado, abstrações prematuras ou ausentes, arquivos grandes, duplicidade, acoplamento excessivo e inconsistências técnicas.

> **Para quem é este documento:** desenvolvedores que precisam entender o custo de manutenção do codebase atual, gestores técnicos que precisam priorizar refatoração incremental, e qualquer pessoa que for adicionar uma nova funcionalidade e queira entender onde os padrões existentes têm rachaduras.

> **Convenção de leitura:**
> - `[OBSERVADO]` — verificado diretamente no código
> - `[INFERIDO]` — deduzido a partir de evidências indiretas
> - Prioridade: **CRÍTICA / ALTA / MÉDIA / BAIXA**

---

## Resumo executivo

O Sentinella Web é um projeto que cresceu rapidamente (~87 migrations em ~16 meses), com sprints curtos e pragmatismo operacional. O resultado é um sistema funcional, mas com dívida técnica concentrada em poucos pontos de alto impacto:

1. **Dois monolitos de dado** (`api.ts` com 2.831 linhas e `database.ts` com 1.410 linhas)
2. **Duplicidade de lógica de negócio** entre TypeScript e PL/pgSQL (SLA)
3. **Arquitetura de migração em transição** — `levantamento_itens` perdeu colunas mas o frontend ainda depende de campos virtuais reconstruídos
4. **Ausência completa de testes automatizados**
5. **Uma seed de desenvolvedor possivelmente ativa em produção**

Nenhum desses problemas impede o sistema de funcionar hoje. Todos aumentam o custo e o risco de cada nova mudança.

---

## DT-01 — `api.ts` Monolito (2.831 linhas)

**Localização:** `src/services/api.ts`
**Prioridade:** ALTA

### Descrição
O arquivo `api.ts` contém 45+ namespaces organizados em um único objeto `api`. Toda a camada de acesso a dados do sistema — levantamentos, itens, vistorias, SLA, usuários, quotas, CNES, focos, canal cidadão, e mais — está em um único arquivo de ~2.831 linhas. `[OBSERVADO]`

### Por que surgiu
O padrão foi definido no início do projeto como "camada única de acesso ao Supabase". A decisão foi correta conceitualmente, mas o arquivo nunca foi dividido à medida que o sistema cresceu.

### Impacto técnico
- Qualquer mudança em qualquer namespace exige abrir um arquivo de quase 3.000 linhas
- Conflitos de merge frequentes em equipe — todos editam o mesmo arquivo
- O TypeScript Language Server fica lento ao analisar um arquivo tão grande
- Sem separação de domínios, é difícil saber o que pertence a qual módulo
- Impossível fazer tree-shaking por domínio — tudo é importado junto

### Impacto de negócio
Cada nova feature leva mais tempo do que deveria. O onboarding de novos desenvolvedores é mais lento porque o arquivo é intimidador.

### Correção incremental sugerida
Não reescrever. Extrair namespaces por domínio sem mudar a interface pública:

```
src/services/
  api.ts           ← re-exporta tudo (backward compat)
  api/
    levantamentos.ts
    itens.ts
    focos.ts
    sla.ts
    vistorias.ts
    ...
```

Cada extração é uma PR isolada. O `api.ts` raiz passa a ser apenas um barrel de re-exportação.

---

## DT-02 — `database.ts` Monolito de Tipos (1.410 linhas)

**Localização:** `src/types/database.ts`
**Prioridade:** MÉDIA

### Descrição
Todas as interfaces TypeScript do domínio — 79 interfaces — estão em um único arquivo. `[OBSERVADO]`

### Impacto técnico
- Acoplamento entre domínios no nível de tipos: a interface `Vistoria` conhece `Imovel` que conhece `RegiaoBairro`
- Difícil identificar quais tipos pertencem a qual módulo
- Qualquer nova feature adiciona ao menos uma interface aqui, aumentando linearmente a complexidade

### Correção incremental sugerida
Mesma estratégia do `api.ts`: criar um diretório `src/types/` com arquivos por domínio. `database.ts` passa a re-exportar tudo.

---

## DT-03 — Componentes de Página com Mais de 700 Linhas

**Localização:** múltiplos arquivos
**Prioridade:** MÉDIA

### Páginas identificadas `[OBSERVADO]`

| Arquivo | Linhas aprox. | Problema principal |
|---------|---------------|--------------------|
| `src/pages/admin/AdminPluvioOperacional.tsx` | ~1.088 | Gerencia estado local + lógica de risco + 3 abas + gráficos |
| `src/components/layout/AppLayout.tsx` | ~1.045 | Layout + sidebar + menu + notificações + quota banner |
| `src/pages/admin/AdminLevantamentos.tsx` | ~1.041 | Lista + detalhes + upload + análise IA tudo junto |
| `src/pages/admin/AdminMapaV3.tsx` | ~980 | Mapa + filtros + clustering + SLA overlay |
| `src/components/levantamentos/ItemDetailPanel.tsx` | ~692 | Detalhes + SLA + casos + YOLO + voz + e-SUS |

### Impacto técnico
- Difícil rastrear um bug sem ler centenas de linhas de contexto irrelevante
- Re-renders desnecessários porque estado de seções não relacionadas está no mesmo componente
- Impossível reutilizar partes do componente em outros contextos

### Caso específico: `ItemDetailPanel.tsx`
Este componente tem pelo menos 7 responsabilidades distintas: exibição de dados do item, timeline de SLA, casos notificados próximos, score YOLO, histórico de recorrência, assistente de voz, e integração e-SUS. Cada adição de sprint foi concatenada aqui. `[OBSERVADO]`

### Correção incremental sugerida
Extrair sub-componentes por responsabilidade dentro da mesma pasta. Não reescrever o componente pai — apenas mover seções para arquivos próprios com props claras.

---

## DT-04 — `AdminSla.tsx` Acessa `supabase` Diretamente

**Localização:** `src/pages/admin/AdminSla.tsx`, linha 5
**Prioridade:** ALTA

### Descrição
`AdminSla.tsx` importa e usa o cliente `supabase` diretamente, em violação do padrão estabelecido no CLAUDE.md: "Nunca acessar `supabase` diretamente em componentes de página". `[OBSERVADO]`

```typescript
// src/pages/admin/AdminSla.tsx:5
import { supabase } from '@/lib/supabase';
```

### Por que é dívida
- As queries desta página não são auditadas pelo padrão centralizado de `api.ts`
- Não há garantia de que `cliente_id` está sendo filtrado corretamente
- Se mudar a forma de acessar o banco (ex: adicionar logging, rate limiting), `AdminSla.tsx` será esquecido
- O padrão de multitenancy pode ter brechas nesta página que nenhum revisor perceberia

### Impacto de negócio
SLA é um módulo crítico de auditoria. Queries sem filtro de `cliente_id` poderiam vazar dados de SLA entre prefeituras.

### Correção incremental sugerida
Mover todas as queries de `AdminSla.tsx` para `api.sla` (já existente) e substituir os `import { supabase }` por `import { api } from '@/services/api'`.

---

## DT-05 — Duplicidade de Lógica de SLA (TypeScript + PL/pgSQL) — PARCIALMENTE RESOLVIDO

**Localização:** `src/types/sla.ts` e migrations de `20250303000000` a `20260710010000`
**Prioridade:** MÉDIA (era ALTA — reduzida após QW-06)
**Ação QW-06 (2026-07-14):** Papel de `calcularSlaHoras()` clarificado com JSDoc explícito; RN-S1 e RN-S3 em `07-regras-de-negocio.md` atualizados.

### Descrição
A lógica de cálculo de SLA existe em dois lugares com implementações independentes:

1. **`calcularSlaHoras()` em TypeScript** — `[SIMULAÇÃO VISUAL APENAS]` — exibe estimativas na UI, não é a fonte oficial.
2. **`sla_aplicar_fatores()` em PL/pgSQL** — chamada pelos triggers de INSERT, é a função que cria os registros reais de SLA no banco.

A **fonte canônica** do prazo é sempre `sla_operacional.prazo_final` (gravado pelo banco). O frontend deve exibir esse valor, não recalculá-lo. `calcularSlaHoras()` é mantida apenas para simular impacto em formulários de configuração.

`[OBSERVADO]` em `src/types/sla.ts` e nas migrations `20250303000000_sla_operacional_gerar_e_rls.sql`, `20250309130000_sla_levantamento_item.sql`, e outras.

### O que ainda é problemático
- As duas implementações ainda podem divergir silenciosamente se os prazos forem alterados em SQL sem atualizar `SLA_RULES` em `sla.ts` (ou vice-versa) — o operador veria uma simulação desatualizada
- Não há teste automatizado verificando sincronia entre as fontes
- `calcularSlaHoras()` ainda ignora P4/P5 (não retorna 0), podendo confundir em previews

### Correção restante
Eliminar `SLA_RULES` do TypeScript e fazer `calcularSlaHoras()` consultar `sla_config` do banco via API quando necessário para preview. Esforço médio; baixa urgência operacional após QW-06.

---

## DT-06 — Dois Sistemas de Recorrência Ativos Simultaneamente

**Localização:** tabela `levantamento_item_recorrencia` (migration `20250311120000`) e coluna `focos_risco.foco_anterior_id` (migration `20260710000000`)
**Prioridade:** MÉDIA

### Descrição
Existem dois mecanismos para rastrear recorrência de focos no mesmo endereço:

1. **Sistema antigo** (`levantamento_item_recorrencia`): trigger `trg_recorrencia_item` verifica raio de 50m e janela de 30 dias; eleva prioridade para Urgente. Ativo desde março de 2025.
2. **Sistema novo** (`focos_risco.foco_anterior_id`): a nova aggregate root permite encadear um foco ao anterior via FK. Introduzido em julho de 2026.

`[OBSERVADO]` ambos referenciados em migrations.

### Por que é problemático
- Não está documentado se o sistema novo substitui o antigo ou se os dois operam em paralelo
- Um foco pode ser marcado como recorrente pelo trigger antigo E ter um `foco_anterior_id` apontando para outra coisa
- O operador não sabe de qual sistema a informação vem

### Correção incremental sugerida
Documentar a intenção: se `foco_anterior_id` substitui a tabela de recorrência, desativar o trigger antigo em uma migration. Se os dois convivem, garantir que não se contradizem.

---

## DT-07 — Campos Virtuais como Shim de Compatibilidade

**Localização:** `src/services/api.ts` — função `enrichItensComFoco()`
**Prioridade:** MÉDIA

### Descrição
A migration `20260711000000_drop_deprecated_levantamento_itens_cols.sql` removeu colunas de `levantamento_itens` que o frontend ainda precisava (`status_atendimento`, `acao_aplicada`, `data_resolucao`, `operador_id`, `checkin_em`, `data_atendimento`). Para não quebrar o frontend, foi criada a função `enrichItensComFoco()` em `api.ts` que reconstrói esses campos buscando dados de `focos_risco`. `[OBSERVADO]`

Os campos são marcados como `@virtual` nos comentários do código e nos tipos TypeScript.

### Por que é dívida
- É um shim de compatibilidade mascarando uma mudança de arquitetura incompleta
- O frontend ainda usa as mesmas propriedades como se estivessem no banco
- Novos desenvolvedores não saberão que esses campos não existem na tabela real
- Qualquer consulta SQL direta (EdgeFunction, pipeline Python) não terá esses campos

### Correção incremental sugerida
Duas opções:
1. **Curto prazo:** documentar claramente no tipo TypeScript que campos `@virtual` vêm de `enrichItensComFoco()`, não do banco
2. **Longo prazo:** migrar o frontend para consumir `focos_risco` diretamente, sem o shim

---

## DT-08 — Dois Sistemas de Prioridade em Conflito

**Localização:** `src/types/database.ts` e migrations de SLA
**Prioridade:** MÉDIA

### Descrição
O sistema usa duas nomenclaturas de prioridade em paralelo:

| Sistema | Valores | Onde aparece |
|---------|---------|--------------|
| SLA (P-codes) | P1 (Crítico), P2 (Urgente), P3 (Alta), P4 (Moderada), P5 (Baixa) | `sla_operacional`, triggers de SLA |
| Focos/Itens | `Crítica`, `Alta`, `Média`, `Baixa`, `Monitoramento` | `focos_risco.prioridade`, `levantamento_itens` |

`[OBSERVADO]` nas migrations e nos tipos TypeScript.

### Por que é problemático
- Um item pode ter `prioridade = 'Crítica'` no `levantamento_itens` mas ter um SLA classificado como P1 — são a mesma coisa mas com nomes diferentes
- A conversão entre os dois sistemas é feita em múltiplos lugares sem uma função central clara
- Operadores veem "Alta prioridade" na interface mas os logs de SLA mostram "P3"

### Correção incremental sugerida
Criar uma função utilitária `prioridadeParaP(prioridade: string): SlaP` que centraliza o mapeamento. Garantir que ela é usada em todos os pontos de conversão.

---

## DT-09 — Seed de Desenvolvedor em Migration de Produção

**Localização:** `supabase/migrations/20250306160000_seed_operador_luiz.sql`
**Prioridade:** CRÍTICA

### Descrição
Existe uma migration que insere um usuário de desenvolvimento diretamente no banco. `[OBSERVADO]` pelo nome do arquivo. Esta migration é executada em todos os ambientes onde as migrations são aplicadas — incluindo potencialmente produção.

### Risco
- Um usuário de desenvolvimento com credenciais conhecidas pode existir em produção
- Se o usuário tem papel `admin` ou `operador`, tem acesso real a dados de prefeituras
- A senha deste usuário pode ser fraca ou compartilhada pela equipe

### Impacto de negócio
Violação de LGPD se o usuário de desenvolvimento acessar dados de prefeituras reais. Risco de acesso não autorizado.

### Correção incremental sugerida
1. Verificar se o usuário existe em produção (`SELECT * FROM auth.users WHERE email LIKE '%luiz%'`)
2. Se existir, remover ou desativar imediatamente
3. Criar uma migration `20260000000000_remove_seed_dev_user.sql` que remove o usuário
4. No futuro, seeds de desenvolvimento devem ser scripts separados nunca incluídos nas migrations

---

## DT-10 — Ausência Total de Testes Automatizados

**Localização:** raiz do projeto, `package.json`
**Prioridade:** CRÍTICA

### Descrição
Não há suíte de testes unitários, de integração ou end-to-end no projeto. `[OBSERVADO]` pela ausência de arquivos `*.test.ts`, `*.spec.ts`, diretório `__tests__`, configuração de Vitest/Jest, ou scripts de teste no `package.json`.

### O que isso significa na prática
- Qualquer refatoração — incluindo as sugeridas neste documento — não tem rede de segurança
- Mudanças em `api.ts` podem quebrar silenciosamente qualquer um dos 45+ namespaces
- A lógica de `enrichItensComFoco()` não é verificada automaticamente
- As regras de SLA não são testadas contra casos extremos (feriados, fim de semana, meia-noite)
- O sistema de filas offline nunca foi testado em um ambiente controlado

### Evidência do impacto
O documento `06-rls-e-seguranca.md` registra pelo menos 7 patches de RLS ao longo de 2026, indicando que erros de segurança foram descobertos em produção, não em testes. `[OBSERVADO]` nas migrations de correção.

### Correção incremental sugerida
Não tentar cobertura total imediatamente. Estratégia de entrada:

1. **Configurar Vitest** (compatível com Vite) — sem quebrar o projeto
2. **Testar `calcularSlaHoras()`** — função pura, sem dependências, fácil de testar
3. **Testar `normalizeScore()`** — mesmas características
4. **Testar a state machine de `focos_risco`** — lógica de transição de estados
5. Expandir gradualmente para lógica de negócio crítica

---

## DT-11 — Trigger de 3 Tentativas Sem Janela de Tempo

**Localização:** `supabase/migrations/20250318002000_vistoria_acesso_calhas.sql`
**Prioridade:** MÉDIA

### Descrição
O trigger `trg_atualizar_perfil_imovel` eleva `prioridade_drone=true` quando um imóvel acumula 3 visitas com `acesso_realizado=false`. A contagem não tem janela de tempo — soma todas as tentativas na história do imóvel. `[OBSERVADO]`

### Problema
- Um imóvel que foi inacessível há 2 anos (ex: proprietário viajando) permanece com `prioridade_drone=true` para sempre
- Não há mecanismo automático para rebaixar a prioridade quando o imóvel volta a ser acessível
- A view `v_imovel_historico_acesso` mostra um percentual de bloqueio baseado no histórico completo, o que pode inflar artificialmente a criticidade

### Correção incremental sugerida
Adicionar janela de tempo na contagem: apenas visitas dos últimos 90 dias. Alternativa: trigger adicional que limpa `prioridade_drone` quando uma vistoria bem-sucedida é registrada.

---

## DT-12 — ~~`payload` JSONB Sobrescrito em Surtos~~ — RESOLVIDO

**Status:** ✅ Resolvido historicamente — nenhuma ação necessária
**Resolvido por:** migrations `20260604000000` (R-38) e `20260710020000` + `20260710030000` (focos_risco)
**Verificado em:** 2026-07-12 (QW-03)

### Descrição original
O trigger `fn_cruzar_caso_com_focos` (originado em `20250318000000`) usava `jsonb_set` para gravar `caso_notificado_proximidade` no `payload` de `levantamento_itens`, sobrescrevendo a cada execução.

### Como foi resolvido
A resolução ocorreu em duas etapas:

1. **Migration `20260604000000` (R-38):** o trigger foi corrigido para acumular IDs em array (`casos_notificados_proximidade`), eliminando a sobrescrita.
2. **Migrations `20260710020000` + `20260710030000`:** a relação caso↔foco foi migrada para `focos_risco.casos_ids` (UUID[]). O `payload` foi limpo de todas as chaves de caso, e o frontend nunca leu essas chaves diretamente — sempre consumiu `caso_foco_cruzamento` via RPC.

### Decisão arquitetural registrada (ADR-QW03)
O campo `payload` de `levantamento_itens` não deve ser usado para armazenar relações entre entidades. Relações são persistidas em tabelas relacionais (`caso_foco_cruzamento`) e no aggregate root `focos_risco`.

### Estado atual
- `levantamento_itens.payload` não contém mais nenhuma chave de caso (limpeza confirmada pela migration `20260710020000`)
- `focos_risco.casos_ids` é a fonte canônica da relação caso↔foco
- Frontend nunca consumiu o campo problemático — sem impacto em produção

---

## DT-13 — `AppLayout.tsx` com Múltiplas Responsabilidades

**Localização:** `src/components/layout/AppLayout.tsx` (~1.045 linhas)
**Prioridade:** BAIXA

### Descrição
O componente de layout principal gerencia: estrutura visual da página, sidebar com navegação, menu mobile, estado de notificações, exibição do quota banner, estado de loading global, e verificações de autenticação. `[OBSERVADO]`

### Impacto
- Qualquer mudança no menu exige editar o mesmo arquivo que controla o loading global
- Testes de sidebar exigiriam mockar toda a autenticação
- O componente renderiza uma quantidade significativa de estado na raiz da árvore React

### Correção incremental sugerida
Extrair `AppSidebar.tsx`, `AppNotifications.tsx` e `AppQuotaBar.tsx` como componentes independentes. O `AppLayout.tsx` torna-se apenas composição.

---

## DT-14 — Importações com `@/` Inconsistentes em Alguns Arquivos

**Localização:** disperso
**Prioridade:** BAIXA

### Descrição
A convenção do projeto é usar o alias `@/` para todos os imports internos. Em alguns arquivos mais antigos, especialmente nas Edge Functions, imports relativos (`../../`) ainda aparecem. `[INFERIDO]` por padrão histórico — Edge Functions usam Deno que tem sistema de módulos diferente.

### Impacto
Baixo. Edge Functions têm ambiente diferente (Deno), então a inconsistência é parcialmente justificada. O risco é desenvolvedores copiarem o padrão das Edge Functions para o frontend.

---

## DT-15 — ~~Fragilidades na Sincronização Offline~~ — RESOLVIDO

**Status:** ✅ Resolvido — QW-05 (2026-07-13)
**Localização:** `src/lib/offlineQueue.ts`, `src/hooks/useOfflineQueue.ts`, `src/pages/operador/OperadorListaImoveis.tsx`

### Descrição original

Três problemas reais identificados na auditoria QW-05 do sistema offline:

**R1 — Sem idempotency key em `save_vistoria`:** `drainQueue()` não protegia contra duplicatas em caso de retry. Se a resposta do `createCompleta` não chegasse (timeout), a operação permanecia na fila e seria reenviada, criando duas vistorias idênticas no banco.

**R2 — Perda silenciosa de assinatura e foto:** Vistorias enviadas em modo offline chegavam ao banco com `assinatura_responsavel_url = null` e `foto_externa_url = null` sem qualquer aviso ao operador. Do ponto de vista de auditoria, vistorias sem assinatura têm valor probatório reduzido.

**R5 — Queries de vistoria não invalidadas após drain:** Após drenagem da fila offline, as queries de `vistorias`, `imoveis` e `vistoria-resumo` não eram invalidadas. O operador poderia ver status desatualizado por até 10 minutos (STALE.LONG).

### Como foi resolvido (QW-05)

1. **Idempotência (R1):** migration `20260713000000` — índice `UNIQUE(imovel_id, agente_id, ciclo, data_visita)`. O `drainQueue()` captura `code === '23505'` no catch e trata como sucesso.

2. **Sinalização de pendências (R2):** migration `20260713000000` — colunas `pendente_assinatura` e `pendente_foto` em `vistorias`. O drain marca automaticamente após o `createCompleta`. Toast persistente (10s) avisa o operador. Badge "Pendente" visível na lista de imóveis.

3. **Invalidação de queries (R5):** `useOfflineQueue.ts` invalida `['vistorias']`, `['imoveis']` e `['vistoria-resumo']` imediatamente após o drain.

---

## Tabela-resumo de prioridades

| ID | Problema | Prioridade | Esforço estimado |
|----|----------|------------|-----------------|
| DT-09 | Seed de dev em produção | CRÍTICA | Pequeno — verificar e remover |
| DT-10 | Sem testes automatizados | CRÍTICA | Grande — incremental por anos |
| DT-01 | `api.ts` monolito | ALTA | Médio — extrair por domínio |
| DT-04 | `AdminSla.tsx` acessa banco direto | ALTA | Pequeno — mover queries para api.sla |
| DT-05 | SLA duplicado TS + PL/pgSQL | MÉDIA (parcial QW-06) | Médio — eliminar SLA_RULES do TS |
| ~~DT-12~~ | ~~`payload` JSONB sobrescrito~~ | ~~ALTA~~ ✅ RESOLVIDO | Resolvido em 2026-07 (ADR-QW03) |
| DT-02 | `database.ts` monolito | MÉDIA | Médio — extrair por domínio |
| DT-03 | Componentes >700 linhas | MÉDIA | Médio — extrair sub-componentes |
| DT-06 | Dois sistemas de recorrência | MÉDIA | Pequeno — decisão + migration |
| DT-07 | Campos virtuais como shim | MÉDIA | Grande — refatorar para focos_risco direto |
| DT-08 | Dois sistemas de prioridade | MÉDIA | Pequeno — função de mapeamento central |
| DT-11 | Trigger sem janela de tempo | MÉDIA | Pequeno — adicionar filtro de data |
| DT-13 | `AppLayout.tsx` misturado | BAIXA | Médio — extrair componentes |
| DT-14 | Imports inconsistentes | BAIXA | Pequeno — apenas nas Edge Functions |
| ~~DT-15~~ | ~~Fragilidades sync offline (duplicata, evidência, UI)~~ | ~~ALTA~~ ✅ RESOLVIDO | Resolvido em 2026-07 (QW-05) |
| ~~DT-16~~ | ~~Ausência de rastreabilidade mínima (escalado_por, reaberto_por, updated_by, origem_offline)~~ | ~~MÉDIA~~ ✅ RESOLVIDO | Resolvido em 2026-07 (QW-07) |

---

*Documento baseado no código-fonte real. Versão 2.3.0, análise em 2026-07-15.*
