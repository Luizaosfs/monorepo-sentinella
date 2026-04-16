# AUDITORIA DETALHADA — PAPEL AGENTE (FIELD AGENT)

**Data:** 2026-04-13 | **Status:** Leitura completa (sem modificações)

## RESUMO EXECUTIVO

Analisados:
- ✓ 6 páginas agente em `/src/pages/agente/`
- ✓ 5 hooks de query + API focosRisco
- ✓ State machine (backend + frontend)
- ✓ Migrations e RLS policies
- ✓ Routing completo

**Resultado:** 2 CRÍTICOS | 4 ALTOS | 3 MÉDIOS

---

## STATE MACHINE CANÔNICA (Backend)

**Fluxo autorizado:**
```
suspeita ─(auto)→ em_triagem ─(gestor)→ aguarda_inspecao
  ↓
aguarda_inspecao ─(agente)→ em_inspecao ─(agente)→ confirmado
  ↓
confirmado ─(agente)→ em_tratamento ─(agente)→ resolvido / descartado
```

**Terminais:** descartado, resolvido (irreversíveis)

---

## PROBLEMAS POR ROTA

### ROTA: `/agente/hoje`

**O que faz:** Tela inicial. Lista imóveis com filtros (todos, atribuído, pendente, retorno, reinspeção, visitado).

**[CRÍTICO #1] useFocosAtribuidos exclui focos confirmado/em_tratamento**

```
Arquivo: src/hooks/queries/useFocosAtribuidos.ts:17-20

Status filtrados: ['aguarda_inspecao', 'em_inspecao']

FALTA: 'confirmado', 'em_tratamento'
```

**Impacto:** Agente confirma foco em AgenteFocoDetalhe, volta para AgenteHoje, 
e o foco desaparece da seção "Atribuídos a mim". Perde continuidade visual.

**Gravidade:** CRÍTICO

---

### ROTA: `/agente/focos/:focoId`

**O que faz:** Operação do agente sobre um foco. Fluxo: inspecionar → confirmar → tratar → resolver.

**[CRÍTICO #2] CTA "Iniciar inspeção" não existe para aguarda_inspecao**

```
Arquivo: src/pages/agente/AgenteFocoDetalhe.tsx:~150-250 (renderCtaSection)

Comentário esperado:
  aguarda_inspecao → "Iniciar inspeção"  (único CTA — agente ainda não viu o foco)

Implementação atual:
  ✗ Nenhum ramo para status === 'aguarda_inspecao'
  
Ramos existentes:
  - em_inspecao → "Confirmar foco" | "Descartar foco"
  - confirmado → "Iniciar tratamento"
  - em_tratamento → "Resolver foco"
```

**Impacto:** Agente abre um foco em `aguarda_inspecao`, vê os dados, mas 
**não tem botão de ação**. Foco fica travado completamente.

**Gravidade:** CRÍTICO (bloqueia MVP)

---

**[ALTO #3] Frontend não valida papéis antes de transicionar**

```
Arquivo: src/services/api.ts (api.focosRisco.transicionar)

Problema: API chama RPC sem pré-validação de papel
Resultado: Usuários veem erros do backend em vez de UI bloquear
```

**Gravidade:** ALTO

---

**[ALTO #4] Lógica backend "pode_resolver_foco" não documentada**

```
Arquivo: src/pages/agente/AgenteReinspecao.tsx:~80-130

Após registrar reinspeção, retorno: { pode_resolver_foco, foco_id }

DESCONHECIDO: Qual é a regra?
  - Sempre true se resultado='resolvido'?
  - Requer N testes positivos?
  - Requer permissão gestor?
  - Só true se última reinspeção pendente?
```

**Impacto:** Impossível validar alinhamento frontend↔backend

**Gravidade:** ALTO

---

### ROTA: `/agente/reinspecao/:reinspecaoId`

**[MÉDIO #5] Navegação hardcoded sem validação**

```
Arquivo: src/pages/agente/AgenteReinspecao.tsx:~100

Button:
  onClick={() => navigate(`/agente/focos/${focoIdParaResolver}`)}

Risco: Foco pode ter sido deletado enquanto agente preenchia formulário
```

**Gravidade:** MÉDIO

---

### ROTA: `/agente/vistoria/:imovelId`

**[MÉDIO #6] Nomenclatura /agente/vistoria sem :id é permissiva**

```
Arquivo: src/components/AppLayout.tsx linha ~40

OPERADOR_ALLOWED_PATHS inclui:
  '/agente/vistoria'  ← sem :imovelId

Rota real:
  /agente/vistoria/:imovelId

Wildcard matching permite /agente/vistoria (vazio) sem validação
```

**Gravidade:** MÉDIO

---

## ANÁLISE DE HOOKS

### useFocosAtribuidos
- **Problema:** Status filter = `['aguarda_inspecao', 'em_inspecao']`
- **Falta:** `'confirmado'`, `'em_tratamento'`
- **Impacto:** Agente perde focos após confirmar

### useReinspecoes
- ✓ Implementado (mas "pode_resolver_foco" não documentado)

### api.focosRisco.transicionar()
- **Problema:** Não valida papel do chamador
- **Risco:** Backend rejeita com exception genérica

---

## VERIFICAÇÃO DE ALINHAMENTO FRONTEND↔BACKEND

| Transição | Backend | Frontend | Status |
|-----------|---------|----------|--------|
| suspeita→em_triagem | ✓ auto | — | ✓ Agente nunca vê |
| em_triagem→aguarda_inspecao | ✓ gestor only | — | ✓ Correto |
| aguarda_inspecao→em_inspecao | ✓ permitido | **✗ Sem CTA** | **CRÍTICO** |
| em_inspecao→confirmado | ✓ permitido | ✓ "Confirmar foco" | ✓ OK |
| em_inspecao→descartado | ✓ permitido | ✓ "Descartar" | ✓ OK |
| confirmado→em_tratamento | ✓ permitido | ✓ "Iniciar tratamento" | ✓ OK |
| em_tratamento→resolvido | ✓ permitido | ✓ "Resolver foco" | ✓ OK |
| descartado→* | ✗ bloqueado | — | ✓ OK |

---

## PRIORIZAÇÃO PARA PILOT

### BLOQUEADORES (Hoje - 1.5 horas)

1. **[CRÍTICO #1]** Expandir `useFocosAtribuidos` para incluir `confirmado`, `em_tratamento`
   - Arquivo: `src/hooks/queries/useFocosAtribuidos.ts`
   - Estimativa: 30min + code review

2. **[CRÍTICO #2]** Adicionar CTA "Iniciar inspeção" para `aguarda_inspecao`
   - Arquivo: `src/pages/agente/AgenteFocoDetalhe.tsx` (renderCtaSection)
   - Estimativa: 1h
   - Código esperado:
     ```typescript
     if (status === 'aguarda_inspecao') {
       return <Button onClick={() => handleTransicionar('em_inspecao')}>
         Iniciar inspeção
       </Button>;
     }
     ```

### IMPEDINDO PILOT (Esta semana - 5 horas)

3. **[ALTO #3]** Implementar validação local de papéis
   - Arquivo: `src/services/api.ts`
   - Criar função `validateFocoTransition(papel, statusAtual, statusNovo)`
   - Estimativa: 2h

4. **[ALTO #4]** Documentar regra "pode_resolver_foco"
   - Investigar `api.reinspecoes.registrar()` backend
   - Comentar em `AgenteReinspecao.tsx`
   - Estimativa: 1.5h

5. **[MÉDIO #6]** Validar parâmetro `:imovelId` em `AgenteVistoria`
   - Adicionar guard: `if (!imovelId) redirect('/agente/hoje')`
   - Estimativa: 30min

6. **[MÉDIO #5]** Validar foco antes de navigate em reinspeção
   - Arquivo: `src/pages/agente/AgenteReinspecao.tsx`
   - Estimativa: 1h

---

## OBSERVAÇÕES GERAIS

**Backend:** Bem estruturado. State machine estrito via trigger, RLS correto, histórico append-only.

**Frontend:** Inconsistente.
- AgenteHoje renderiza bem
- **AgenteFocoDetalhe tem lacuna crítica** (aguarda_inspecao)
- Hooks têm guards defensivos (poisoning check) mas não deveriam receber dados ruins
- API não replica validações do backend

**Recomendação:** Congelar state machine (feito ✓). Implementar validação local no frontend 
ANTES de chamar RPC. Adicionar E2E test: agente completa workflow 1 foco inteiro.

