# Modo Analítico — Conceito e Arquitetura de UI

> Versão: P8.1 | Data: 2026-04-14

---

## Objetivo

Expor os indicadores analíticos completos da consolidação de vistoria de forma opcional,
sem poluir a UI padrão e sem impactar a experiência do agente de campo.

---

## O que é

Um toggle global (ligado/desligado) que:
- **Quando desligado (padrão):** UI exibe leitura rápida — prioridade + badges + motivo
- **Quando ligado:** UI adiciona bloco detalhado com os 5 indicadores rotulados explicitamente

---

## O que NÃO é

- Não altera dados
- Não altera regras de consolidação
- Não recalcula nada no frontend
- Não cria novas chamadas ao banco

---

## Comportamento

| Aspecto | Detalhe |
|---|---|
| Toggle | Botão "Modo analítico" / "Analítico ativo" no footer do sidebar |
| Persistência | `localStorage` — chave `sentinella_modo_analitico` ('1' = ativo) |
| Visibilidade | Apenas para `supervisor`, `admin` e `analista_regional` |
| Escopo | Global — persiste entre navegações na mesma sessão e sessões futuras |
| Performance | Sem fetch adicional — dados já chegam com o payload de vistoria |

---

## Quando usar

- Supervisor analisando um imóvel de alto risco e querendo entender todos os fatores
- Gestor fazendo triagem e precisando de leitura detalhada
- Analista regional avaliando padrões de risco por dimensão

---

## Quando NÃO usar

- Na rotina diária de leitura de listas (modo padrão é suficiente)
- Durante operação em campo pelo agente (agente não tem acesso ao toggle)
- Quando a leitura rápida já é conclusiva para a ação

---

## Impacto na UI

| Tela | Modo OFF | Modo ON |
|---|---|---|
| `GestorFocoDetalhe` — card de vistoria | Prioridade + badges + motivo | + bloco "Análise detalhada" |
| `FichaImovel360` — card de vistoria | Prioridade + badges + motivo | + bloco "Análise detalhada" |
| `CentralOperacional` — lista | Prioridade + badges (sem alteração) | Sem alteração |
| Sidebar footer | Botão "Modo analítico" (cinza) | Botão "Analítico ativo" (azul) |

---

## Arquitetura

```
ModoAnaliticoProvider (App.tsx)
  └─ ModoAnaliticoContext { ativo: boolean, toggle: () => void }
       ├─ AppLayout.tsx → toggle button no sidebar footer
       ├─ GestorFocoDetalhe.tsx → useModoAnalitico() → ConsolidacaoAnaliticaDetalhe
       └─ FichaImovel360.tsx → useModoAnalitico() → ConsolidacaoAnaliticaDetalhe
```

---

## Arquivos relevantes

| Arquivo | Responsabilidade |
|---|---|
| `src/hooks/useModoAnalitico.tsx` | Context + Provider + hook |
| `src/components/consolidacao/ConsolidacaoAnaliticaDetalhe.tsx` | Bloco visual detalhado |
| `src/components/AppLayout.tsx` | Toggle button no sidebar |
| `src/App.tsx` | `<ModoAnaliticoProvider>` envolvendo toda a app |
