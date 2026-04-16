# 12 — Roadmap de Implementação

## Objetivo deste documento

Apresentar um plano incremental, seguro e realista de implementação das melhorias identificadas, organizado em fases que não quebram funcionalidades existentes e consideram que o sistema já está em operação com prefeituras reais.

> **Para quem é este documento:** tech lead que precisa planejar os próximos meses de desenvolvimento, gestor que precisa comunicar prioridades para a equipe, desenvolvedor que quer entender a visão de evolução do sistema.

> **Premissas do roadmap:**
> - O sistema está em produção e não pode ser interrompido
> - Mudanças de banco de dados requerem migrations cuidadosas e testadas
> - Cada fase deve ser completamente segura de encerrar — não há dependências que forcem continuar
> - Prioridade: segurança e dados primeiro, organização depois, produto por último

---

## Visão geral das fases

```
FASE 1 — Entendimento e Auditoria         (1–2 semanas)
  │  Verificações de segurança sem deploy
  │  Não muda nada no código
  ▼
FASE 2 — Correções Críticas               (2–4 semanas)
  │  Correções de segurança e dados
  │  Patches cirúrgicos no banco e código
  ▼
FASE 3 — Qualidade e Cobertura            (4–8 semanas)
  │  Testes, documentação nos tipos, padrões
  │  Sem mudanças de comportamento
  ▼
FASE 4 — Organização Arquitetural         (4–8 semanas, paralela a features)
  │  Refatoração estrutural incremental
  │  Extração de módulos sem mudar interface pública
  ▼
FASE 5 — Evolução de Produto              (ongoing)
     Novas funcionalidades sobre base consolidada
     Observabilidade, testes de RLS, backend dedicado (futuro)
```

---

## FASE 1 — Entendimento e Auditoria

**Duração:** 1–2 semanas
**Objetivo:** Verificar o estado real do sistema em produção antes de fazer qualquer mudança. Esta fase é de leitura e auditoria — nenhum código é alterado.
**Risco:** Nulo — nenhuma mudança em produção.

### Tarefas

#### 1.1 — Auditoria de segurança no banco de produção

Executar no banco de produção (ambiente Supabase real):

```sql
-- T1: Verificar usuário de desenvolvimento
SELECT id, email, created_at, last_sign_in_at, email_confirmed_at
FROM auth.users
WHERE email ILIKE '%luiz%'
   OR email ILIKE '%dev%'
   OR email ILIKE '%teste%'
   OR email ILIKE '%test%';

-- T2: Verificar RLS em todas as tabelas
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename ASC;
-- Atenção especial: yolo_feedback, levantamento_analise_ia

-- T3: Verificar payload de cruzamentos
SELECT
  li.id,
  li.payload->'caso_notificado_proximidade' as caso_no_payload,
  COUNT(cfc.id) as casos_na_tabela_cruzamento
FROM levantamento_itens li
LEFT JOIN caso_foco_cruzamento cfc ON cfc.levantamento_item_id = li.id
WHERE li.payload ? 'caso_notificado_proximidade'
GROUP BY li.id, li.payload
HAVING COUNT(cfc.id) > 1
LIMIT 20;
-- Se retornar linhas, o bug DT-12 está ativo

-- T4: Verificar funções SECURITY DEFINER
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND security_type = 'DEFINER'
ORDER BY routine_name;
```

**Entregável:** Relatório de auditoria com resultados das queries acima.

#### 1.2 — Auditoria do pipeline Python

Acessar o repositório do pipeline Python e verificar:
- Qual variável de ambiente é usada para autenticação com o Supabase
- Se é `SUPABASE_SERVICE_KEY` (service_role) ou `SUPABASE_ANON_KEY` (sujeita a RLS)
- Quais tabelas o pipeline lê e escreve
- Se todos os selects têm filtro de `cliente_id`

**Entregável:** Documento listando: key usada, tabelas acessadas, presença/ausência de filtros por `cliente_id`.

#### 1.3 — Mapear onde o payload JSONB é lido no frontend

Identificar todos os componentes que leem `payload.caso_notificado_proximidade` dos levantamento_itens:

```bash
grep -r "caso_notificado_proximidade" src/ --include="*.tsx" --include="*.ts"
```

**Entregável:** Lista de componentes afetados pelo bug DT-12.

#### 1.4 — Inventariar queries diretas ao Supabase fora de `api.ts`

```bash
grep -r "from '@/lib/supabase'" src/pages --include="*.tsx"
grep -r "from '@/lib/supabase'" src/components --include="*.tsx"
```

**Entregável:** Lista completa de violações do padrão, além do `AdminSla.tsx` já conhecido.

---

## FASE 2 — Correções Críticas

**Duração:** 2–4 semanas
**Objetivo:** Eliminar riscos de segurança e integridade de dados identificados na Fase 1.
**Risco:** Médio — mudanças no banco e em código crítico. Cada item deve ser revisado antes de deploy.
**Pré-requisito:** Fase 1 completa.

### Tarefas

#### 2.1 — Remover usuário de desenvolvimento de produção

Se encontrado na Fase 1:

```typescript
// Via Supabase Auth Admin API (não fazer SQL direto em auth.users):
const { error } = await supabase.auth.admin.deleteUser(userId);
```

Criar migration documentando a remoção:
```sql
-- 20260400000000_remove_seed_dev_users.sql
-- Remove usuários de desenvolvimento criados pela migration 20250306160000
-- Nota: a remoção real foi feita via Auth Admin API em [data]
-- Esta migration serve apenas como registro de auditoria
COMMENT ON TABLE auth.users IS 'Usuário seed de desenvolvimento removido em [data]';
```

**Revisão necessária:** Sim — confirmar que o usuário não é usado em nenhum processo automatizado.

#### 2.2 — Corrigir RLS em tabelas sem proteção

Para cada tabela encontrada com `rowsecurity = false`:

```sql
-- 20260400001000_habilitar_rls_tabelas_pendentes.sql
ALTER TABLE yolo_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "isolamento_cliente_yolo" ON yolo_feedback
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM levantamento_itens li
      JOIN levantamentos l ON l.id = li.levantamento_id
      WHERE li.id = yolo_feedback.item_id
        AND l.cliente_id = (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid())
    )
  );

ALTER TABLE levantamento_analise_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "isolamento_cliente_analise" ON levantamento_analise_ia
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM levantamentos l
      WHERE l.id = levantamento_analise_ia.levantamento_id
        AND l.cliente_id = (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid())
    )
  );
```

**Revisão necessária:** Sim — testar com usuário de cliente A que não consegue ver dados de cliente B.

#### 2.3 — Corrigir sobrescrita do payload em surtos

```sql
-- 20260400002000_fix_payload_cruzamento_surto.sql
CREATE OR REPLACE FUNCTION fn_cruzar_caso_focos()
RETURNS TRIGGER AS $$
BEGIN
  -- Busca focos do mesmo cliente em raio de 300m
  UPDATE levantamento_itens li
  SET
    prioridade = 'Crítica',
    payload = jsonb_set(
      COALESCE(li.payload, '{}'),
      '{casos_notificados_proximos}',
      COALESCE(li.payload->'casos_notificados_proximos', '[]') || to_jsonb(NEW.id::text)
    ),
    updated_at = now()
  FROM levantamentos l
  WHERE li.levantamento_id = l.id
    AND l.cliente_id = NEW.cliente_id
    AND ST_DWithin(
      li.localizacao::geography,
      ST_Point(NEW.longitude, NEW.latitude)::geography,
      300
    );

  -- Insere cruzamento
  INSERT INTO caso_foco_cruzamento (caso_id, levantamento_item_id, distancia_metros)
  SELECT NEW.id, li.id,
    ST_Distance(li.localizacao::geography, ST_Point(NEW.longitude, NEW.latitude)::geography)
  FROM levantamento_itens li
  JOIN levantamentos l ON l.id = li.levantamento_id
  WHERE l.cliente_id = NEW.cliente_id
    AND ST_DWithin(
      li.localizacao::geography,
      ST_Point(NEW.longitude, NEW.latitude)::geography,
      300
    )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Revisão necessária:** Sim — testar em ambiente de staging com múltiplos casos no mesmo endereço.

#### 2.4 — Mover queries de `AdminSla.tsx` para `api.sla`

Passo a passo:
1. Identificar cada chamada a `supabase` em `AdminSla.tsx`
2. Para cada uma: verificar se já existe método equivalente em `api.sla`
3. Se não existir, criar o método em `api.ts`
4. Substituir a chamada no componente
5. Remover `import { supabase }` quando todas as chamadas forem migradas

**Revisão necessária:** Sim — testar toda a funcionalidade de SLA após a mudança.

#### 2.5 — Implementar rate limiting no Canal Cidadão

```sql
-- 20260400003000_rate_limit_canal_cidadao.sql
CREATE TABLE canal_cidadao_rate_limit (
  ip_hash text NOT NULL,
  slug text NOT NULL,
  contagem int NOT NULL DEFAULT 0,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash, slug)
);

-- Sem RLS (tabela de controle, não tem dados de cliente)
-- Limpeza automática: entradas com mais de 1 hora
CREATE INDEX ON canal_cidadao_rate_limit (janela_inicio);
```

Atualizar a RPC `canal_cidadao_denunciar` para verificar o limite antes de inserir.

**Revisão necessária:** Sim — testar que usuários legítimos não são bloqueados.

#### 2.6 — Auditar e documentar pipeline Python

Com base no resultado da auditoria (1.2):
- Se usa `service_role`: revisar todos os filtros + criar Issue para migração futura para Edge Function intermediária
- Se usa `anon key` com service account: documentar e garantir que o `cliente_id` é sempre passado como variável de ambiente ou parâmetro de execução

**Revisão necessária:** Sim — envolver responsável pelo pipeline Python.

---

## FASE 3 — Qualidade e Cobertura

**Duração:** 4–8 semanas (pode ser executada em paralelo com features de produto)
**Objetivo:** Estabelecer uma base de qualidade que torne as fases seguintes mais seguras.
**Risco:** Baixo — sem mudanças de comportamento.

### Tarefas

#### 3.1 — Configurar suíte de testes (Vitest)

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event
```

`vite.config.ts`:
```typescript
export default defineConfig({
  // ... configurações existentes
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

Estrutura inicial:
```
src/test/
  setup.ts              ← imports globais, mocks do Supabase
  fixtures/
    levantamento.ts     ← dados de teste reutilizáveis
    sla.ts
    focos.ts
```

#### 3.2 — Testes de funções puras (sem dependências externas)

Prioridade decrescente:

```typescript
// src/types/sla.test.ts
describe('calcularSlaHoras', () => {
  it('retorna 4h para prioridade Crítica sem fatores', () => {...});
  it('aplica redução de 30% para risco Muito Alto', () => {...});
  it('nunca retorna menos de 2h (mínimo absoluto)', () => {...});
  it('P4 e P5 não geram SLA automático', () => {...});
});

// src/lib/normalizeScore.test.ts
describe('normalizeScore', () => {
  it('converte 0.87 para 0.87 (já normalizado)', () => {...});
  it('converte 87 para 0.87 (escala 0-100)', () => {...});
  it('retorna null para null', () => {...});
  it('retorna null para undefined', () => {...});
});
```

#### 3.3 — Testes da state machine de focos_risco

```typescript
// src/services/focos.test.ts
describe('transições de estado focos_risco', () => {
  it('suspeita → em_triagem: válida', () => {...});
  it('suspeita → confirmado: inválida', () => {...});
  it('resolvido → qualquer: bloqueada (estado terminal)', () => {...});
  it('descartado → qualquer: bloqueada (estado terminal)', () => {...});
});
```

#### 3.4 — Documentar campos @virtual nos tipos

Para cada campo virtual em `database.ts` (os que foram removidos do banco em `20260711000000`):

```typescript
interface LevantamentoItem {
  // Campos reais do banco:
  id: string;
  levantamento_id: string;
  // ...

  /**
   * @virtual Não existe em levantamento_itens no banco.
   * Reconstruído por enrichItensComFoco() a partir de focos_risco.status.
   * Valor undefined se o item não tiver foco_risco vinculado.
   */
  status_atendimento?: string;

  /** @virtual Ver status_atendimento */
  acao_aplicada?: string;
  // ...
}
```

#### 3.5 — Criar função central de mapeamento de prioridade

```typescript
// src/lib/prioridade.ts
// Centralizar toda conversão entre sistemas de nomenclatura
```

Ver detalhes em `11-melhorias-priorizadas.md` → MP-03.

#### 3.6 — Adicionar aviso de incompatibilidade Web Push no iOS

Ver QW-05 em `11-melhorias-priorizadas.md`.

#### 3.7 — Corrigir trigger de 3 tentativas (adicionar janela de tempo)

Ver MP-02 em `11-melhorias-priorizadas.md`.

#### 3.8 — Decidir e documentar sistema de recorrência

Reunião de equipe para decidir: o sistema de recorrência via `levantamento_item_recorrencia` é mantido ou substituído por `focos_risco.foco_anterior_id`? Documentar a decisão e criar migration se necessário.

---

## FASE 4 — Organização Arquitetural

**Duração:** 4–8 semanas (em paralelo com features de produto)
**Objetivo:** Refatorar a estrutura do código sem alterar comportamento, reduzindo o custo de cada nova feature.
**Risco:** Médio — mudanças estruturais. Fase 3 (testes) reduz o risco significativamente.
**Pré-requisito:** Fase 3 completa (especialmente os testes).

### Regra de ouro desta fase

> Toda extração deve ser feita em PRs separadas. Uma extração por PR. Cada PR deve passar nos testes existentes sem modificação.

### Tarefas

#### 4.1 — Dividir `api.ts` em módulos por domínio

Ordem de extração (começar pelos módulos mais estáveis e menos acoplados):

| Sprint | Namespaces a extrair | Arquivos criados |
|--------|---------------------|-----------------|
| 1 | `api.quotas`, `api.pushSubscriptions` | `api/quotas.ts`, `api/push.ts` |
| 2 | `api.slaFeriados`, `api.slaConfigRegiao` | `api/sla-config.ts` |
| 3 | `api.planoAcaoCatalogo`, `api.drones`, `api.voos` | `api/plano-acao.ts`, `api/drones.ts` |
| 4 | `api.yoloFeedback`, `api.analiseIa` | `api/yolo.ts` |
| 5 | `api.integracoes`, `api.notificacoesESUS`, `api.cnesSync` | `api/integracoes.ts` |
| 6 | `api.imoveis`, `api.vistorias` | `api/imoveis.ts`, `api/vistorias.ts` |
| 7 | `api.casosNotificados`, `api.unidadesSaude` | `api/casos.ts` |
| 8 | `api.levantamentos`, `api.itens` | `api/levantamentos.ts` |
| 9 | `api.sla` | `api/sla.ts` |
| 10 | `api.usuarios`, `api.admin` | `api/usuarios.ts`, `api/admin.ts` |

`api.ts` raiz após todas as extrações:
```typescript
// src/services/api.ts — barrel de re-exportação
export { api } from './api/index';
```

#### 4.2 — Dividir `database.ts` em tipos por domínio

Após ME-01, os domínios estarão claros. Extrair tipos seguindo os mesmos domínios dos módulos de `api/`.

#### 4.3 — Extrair sub-componentes de `ItemDetailPanel.tsx`

Seguir o plano em ME-03 de `11-melhorias-priorizadas.md`. Extrair um sub-componente por PR.

#### 4.4 — Extrair sub-componentes de `AppLayout.tsx`

Extrair: `AppSidebar.tsx`, `AppNotifications.tsx`, `AppQuotaBar.tsx`.

#### 4.5 — Adicionar paginação nas listagens críticas

Seguir AP-05 de `11-melhorias-priorizadas.md`. Uma listagem por PR:
1. `AdminCasosNotificados.tsx`
2. `OperadorListaImoveis.tsx`
3. `AdminLevantamentos.tsx`

---

## FASE 5 — Evolução de Produto

**Duração:** Ongoing
**Objetivo:** Novas funcionalidades sobre uma base de código mais sólida, com testes e organização estabelecidos.

### Iniciativas planejadas

#### 5.1 — Painel de monitoramento do pipeline Python

Com o pipeline auditado (2.6) e a tabela `pipeline_runs` criada (MP-04), implementar:
- Página `AdminPipelineStatus.tsx` com status de processamento de cada voo
- Alertas automáticos quando um processamento falha
- Reprocessamento manual de voos com falha

#### 5.2 — Testes de RLS automatizados

Com a suíte de testes estabelecida (Fase 3), adicionar testes de isolamento de dados:
```typescript
// src/test/rls/isolamento.test.ts
it('usuário do cliente A não vê dados do cliente B', async () => {
  const supabaseClienteA = createClient(url, anonKey);
  await supabaseClienteA.auth.signIn({ ... }); // usuário do cliente A
  const { data } = await supabaseClienteA.from('levantamento_itens').select('*');
  expect(data.every(item => item.cliente_id === CLIENTE_A_ID)).toBe(true);
});
```

#### 5.3 — Observabilidade: logging estruturado

Implementar logging em Edge Functions e pipeline:
```typescript
// Padrão de log estruturado para Edge Functions
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  function: 'relatorio-semanal',
  cliente_id: clienteId,
  action: 'email_sent',
  recipient: email,
  status: 'success',
}));
```

#### 5.4 — Política de retenção de dados

Implementar via `pg_cron`:
- `levantamento_analise_ia`: manter 6 meses de análises de levantamentos concluídos
- `canal_cidadao_rate_limit`: limpar entradas com mais de 24h
- Imagens Cloudinary: limpeza de levantamentos com mais de 12 meses

#### 5.5 — Avaliação de migração para NestJS

Quando o número de prefeituras ou a complexidade das regras de negócio justificar, avaliar a migração descrita em `memory/project_migration_nestjs.md`. Esta avaliação deve acontecer quando:
- A equipe tiver mais de 3 desenvolvedores ativos
- O monolito de `api.ts` apresentar conflitos de merge frequentes mesmo após a extração (Fase 4)
- As regras de negócio exigirem lógica que não cabe bem nem no frontend nem no banco

---

## Dependências entre fases

```
Fase 1 (Auditoria)
  ├── Fase 2.1 (Remover usuário dev)          ← depende de 1.1
  ├── Fase 2.2 (Corrigir RLS)                 ← depende de 1.1
  ├── Fase 2.3 (Corrigir payload)             ← independente de 1.x
  ├── Fase 2.4 (AdminSla)                     ← depende de 1.4
  ├── Fase 2.5 (Rate limiting)                ← independente
  └── Fase 2.6 (Auditar pipeline)             ← depende de 1.2

Fase 3 (Qualidade)
  ├── Fase 3.1–3.2 (Configurar e testes)      ← independente de Fase 2
  └── Fase 3.3–3.8                            ← pode começar durante Fase 2

Fase 4 (Arquitetura)                          ← precisa de Fase 3.1–3.2
  └── 4.1, 4.2, 4.3, 4.4, 4.5 → paralelos entre si, sequenciais por PR

Fase 5 (Produto)
  ├── 5.1 (Pipeline monitor)                  ← precisa de Fase 2.6
  ├── 5.2 (Testes RLS)                        ← precisa de Fase 3.1
  ├── 5.3 (Observabilidade)                   ← independente
  ├── 5.4 (Retenção)                          ← independente
  └── 5.5 (NestJS)                            ← precisa de Fase 4 completa
```

---

## Critérios de conclusão por fase

### Fase 1 — Concluída quando:
- [ ] Queries de auditoria executadas no banco de produção
- [ ] Pipeline Python auditado
- [ ] Relatório de achados escrito e revisado pela equipe

### Fase 2 — Concluída quando:
- [ ] Usuário de dev removido (ou confirmado que não existe)
- [ ] RLS habilitado em todas as tabelas identificadas na Fase 1
- [ ] Bug de sobrescrita de payload corrigido e verificado em produção
- [ ] `AdminSla.tsx` não importa mais `supabase` diretamente
- [ ] Rate limiting ativo no Canal Cidadão
- [ ] Pipeline Python documentado (key usada, filtros presentes)

### Fase 3 — Concluída quando:
- [ ] Vitest configurado e rodando em CI (ou localmente)
- [ ] `calcularSlaHoras()` com cobertura ≥ 80%
- [ ] `normalizeScore()` com cobertura 100%
- [ ] State machine de `focos_risco` com pelo menos 5 casos de teste
- [ ] Campos `@virtual` documentados em `database.ts`
- [ ] Decisão de sistema de recorrência documentada

### Fase 4 — Concluída quando:
- [ ] `api.ts` é apenas um barrel de re-exportação
- [ ] `database.ts` é apenas um barrel de re-exportação
- [ ] `ItemDetailPanel.tsx` tem menos de 250 linhas
- [ ] Paginação implementada nas 3 listagens críticas
- [ ] Testes existentes continuam passando

### Fase 5 — Nunca "concluída" (evolução contínua):
- [ ] Painel de pipeline implementado
- [ ] Testes de RLS automatizados cobrindo as 5 tabelas mais sensíveis
- [ ] Logging estruturado em todas as Edge Functions
- [ ] Política de retenção ativa

---

## Estimativa de esforço por fase

| Fase | Duração | Paralela com features? | Risco |
|------|---------|----------------------|-------|
| 1 — Auditoria | 1–2 semanas | Sim | Nulo |
| 2 — Correções críticas | 2–4 semanas | Sim (cuidado) | Médio |
| 3 — Qualidade | 4–8 semanas | Sim | Baixo |
| 4 — Arquitetura | 4–8 semanas | Sim | Médio |
| 5 — Produto | Ongoing | É o produto | Variável |

**Total estimado para Fases 1–4:** 11–22 semanas (3–6 meses), trabalhando em paralelo com o desenvolvimento normal de produto.

---

*Documento baseado no código-fonte real. Versão 2.1.0, análise em 2026-03-26.*
