# SLA Inteligente — Implantação Fase 1

**Data de implantação:** Abril de 2026
**Status:** Produção
**Fases implementadas:** A (base analítica), B (integração frontend), C (alertas visuais e priorização)

---

## 1. O que foi implementado

### Fase A — Base analítica no banco

- **Tabela `sla_foco_config`**: Configuração de prazos por fase (`triagem`, `inspecao`, `confirmacao`, `tratamento`) por cliente. Seed automático ao criar novo cliente. Configurável via SQL ou futura UI.
- **View `v_tempo_por_estado_foco`**: Calcula minutos em cada estado histórico do foco usando função `LEAD()` sobre `foco_risco_historico`. Flag `eh_estado_atual` identifica o estado corrente.
- **`v_focos_risco_ativos` enriquecida** com 4 novas colunas:
  - `fase_sla` — fase epidemiológica atual: `triagem | inspecao | confirmacao | tratamento | encerrado`
  - `tempo_em_estado_atual_min` — minutos desde a última transição de estado
  - `prazo_fase_min` — prazo configurado para a fase atual (de `sla_foco_config`)
  - `status_sla_inteligente` — classificação: `ok | atencao | critico | vencido | sem_prazo | encerrado`
- **Índice de performance** em `foco_risco_historico(foco_risco_id, alterado_em ASC)`.

Limiares de classificação:
| Status | Critério |
|---|---|
| `ok` | tempo < 70% do prazo |
| `atencao` | tempo ≥ 70% e < 90% do prazo |
| `critico` | tempo ≥ 90% do prazo (ainda dentro) |
| `vencido` | tempo > prazo |
| `sem_prazo` | fase sem configuração em `sla_foco_config` |
| `encerrado` | foco em `resolvido` ou `descartado` |

### Fase B — Integração no frontend

- **`src/lib/slaInteligente.ts`**: Labels, cores Tailwind e formatter de tempo (`formatarTempoMin`).
- **`src/hooks/queries/useSlaInteligente.ts`**: Hooks `useSlaInteligente`, `useSlaInteligenteCriticos`, `useSlaInteligenteByFoco`.
- **`api.slaInteligente`** em `api.ts`: `listByCliente`, `listCriticos`, `getByFocoId`.
- **`FocoRiscoAtivo`** em `database.ts` atualizado com os 4 campos da view.
- **`GestorFocos`**: sublabel SLA inteligente abaixo do `SlaBadge` (fase + status + tempo).
- **`GestorFocoDetalhe`**: aba SLA dividida em "SLA Operacional" (existente) e "SLA Inteligente" (novo card com barra de progresso).
- **`CentralOperacional`**: seção com contadores (vencido/crítico/atenção) e top 5 focos mais urgentes.

### Fase C — Alertas visuais e priorização

- **`src/lib/slaInteligenteVisual.ts`**: Helper visual centralizado com `PRIORIDADE_SLA_INT` (1=mais urgente), `DESTAQUE_LINHA_SLA` (classes de fundo por status), `ICONE_SLA`.
- **Ordenação inteligente** em `useSlaInteligente`: focos ordenados por prioridade SLA (vencido→critico→atencao→ok) e depois por tempo decrescente.
- **Destaque de linha em `GestorFocos`**: linhas com `status_sla_inteligente = 'vencido'` ganham fundo vermelho; `'critico'` ganham fundo laranja leve.
- **Contadores clicáveis em `CentralOperacional`**: clicar em Vencido/Crítico/Atenção navega para `/gestor/focos?sla_int=<status>`.
- **Banner informativo em `GestorFocos`**: ao chegar via link com `?sla_int=`, um banner identifica o filtro ativo com botão de dispensa.
- **Gargalo por fase em `CentralOperacional`**: distribuição de focos por fase (triagem/inspeção/confirmação/tratamento) ordenada por volume; fase com maior volume recebe rótulo "gargalo".
- **Ícone de alerta em `GestorFocoDetalhe`**: card SLA Inteligente exibe `AlertTriangle` laranja/vermelho para critico/vencido; borda colorida no card.

---

## 2. O que NÃO foi implementado

- **Push notifications**: nenhum Web Push, VAPID ou service worker foi criado para o SLA inteligente.
- **E-mail automático**: nenhuma edge function de e-mail foi criada ou modificada.
- **Cron ou automação**: nenhum job agendado, nenhuma trigger nova no banco.
- **Escalonamento automático**: focos que vencem o SLA inteligente não mudam de estado, não são reatribuídos e não geram alertas sonoros automaticamente.
- **Notificação por papel**: o SLA inteligente é visível apenas para gestor/admin — não foi exposto para agentes.
- **Regras de negócio alteradas**: nenhuma transição de estado, nenhum SLA operacional e nenhuma lógica de fila foi modificada.

---

## 3. Como o gestor deve usar

### Ponto de entrada: Central Operacional (`/gestor/central`)

1. Acesse a seção **SLA Inteligente por fase** (abaixo do gráfico de score territorial).
2. Os contadores mostram quantos focos estão em cada nível de urgência.
   - **Vencido** (vermelho): prazo de fase já ultrapassado — ação imediata.
   - **Crítico** (laranja): ≥ 90% do prazo consumido — prioridade alta.
   - **Atenção** (âmbar): ≥ 70% do prazo consumido — monitorar.
3. Clique em qualquer contador para ir diretamente à lista filtrada em `/gestor/focos`.
4. O **gargalo por fase** mostra onde os focos estão acumulando. Se "Triagem" tiver muitos focos, a equipe de triagem está sobrecarregada.
5. O **top 5** lista os focos mais urgentes com link direto ao detalhe.

### Lista de focos (`/gestor/focos`)

- A coluna **SLA** agora exibe dois níveis: badge operacional (existente) + sublabel SLA Inteligente (fase + status + tempo).
- Linhas com fundo avermelhado = SLA vencido (operacional ou inteligente).
- Linhas com fundo laranja = SLA inteligente crítico.
- Ao vir da Central com filtro, um banner amarelo indica o contexto; clique no X para dispensar.

### Detalhe do foco (`/gestor/focos/:id`) → aba SLA

- **SLA Operacional**: comportamento existente — prazo calculado a partir de `confirmado_em`.
- **SLA Inteligente**: fase atual, tempo no estado, prazo configurado e barra de progresso percentual.
  - Barra vermelha = vencido, laranja = crítico, âmbar = atenção, verde = ok.
  - Card com borda colorida para vencido/crítico.

---

## 4. Limitações atuais

| Limitação | Impacto | Workaround |
|---|---|---|
| Sem alerta proativo | Gestor precisa acessar o sistema para saber de SLAs vencendo | Acessar Central Operacional no início do turno |
| Sem automação de escalonamento | Focos vencidos não são re-priorizados automaticamente | Usar lista filtrada por "Vencido" diariamente |
| Ordenação server-side limitada | `v_focos_risco_ativos` não aceita ORDER BY semântico via Supabase client | Ordenação aplicada client-side nos hooks |
| `v_focos_risco_ativos` não inclui terminais | `resolvido`/`descartado` sempre mostram `status_sla_inteligente = 'encerrado'` | Normal — terminais não precisam de SLA |
| `sla_foco_config` não editável via UI | Prazos por fase só ajustáveis via SQL | Futura tela `/admin/sla-inteligente-config` |
| Sem histórico de SLA inteligente vencido | Não há log de quantas vezes um foco venceu a fase | Pode ser implementado como view analítica na Fase 2 |

---

## 5. Próximos passos possíveis

### Alta prioridade

- **Notificações automáticas por fase**: Web Push quando foco entra em `atencao` ou `vencido` por fase (edge function + cron).
- **UI de configuração `sla_foco_config`**: tela admin para ajustar prazos por fase por cliente (sem SQL).
- **Integração com SLA operacional**: unificar os dois sistemas de SLA em uma visão consolidada.

### Média prioridade

- **Escalonamento automático**: ao vencer SLA de fase, criar notificação interna ou elevar prioridade do foco.
- **Analytics de SLA inteligente**: histórico de compliance por fase, por bairro, por agente.
- **Filtro server-side por `status_sla_inteligente`**: adicionar `status_sla_inteligente` a `FocoRiscoFiltros` e à query de `focosRisco.list` para paginação correta.
- **Dashboard de SLA**: aba dedicada em `AdminSla.tsx` com métricas de cumprimento por fase e por cliente.

### Baixa prioridade

- **E-mail resumo semanal de SLA inteligente**: integrar no relatório semanal já existente.
- **Exportação CSV** de focos com SLA vencido por fase.
- **Comparativo entre ciclos**: ver se a taxa de SLA vencido melhorou ou piorou entre ciclos bimestrais.

---

## Arquivos do módulo

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20261018011000_sla_inteligente_fase_a_base.sql` | Toda a infraestrutura de banco (tabela, views, índice, seed) |
| `src/lib/slaInteligente.ts` | Tipos, labels, cores, `formatarTempoMin`, `SEVERIDADE_SLA_INT` |
| `src/lib/slaInteligenteVisual.ts` | Re-exporta slaInteligente + `PRIORIDADE_SLA_INT`, `DESTAQUE_LINHA_SLA`, `ICONE_SLA` |
| `src/hooks/queries/useSlaInteligente.ts` | Hooks com ordenação client-side por prioridade |
| `src/services/api.ts` → `api.slaInteligente` | `listByCliente`, `listCriticos`, `getByFocoId` |
| `src/types/database.ts` → `FocoRiscoAtivo` | 4 novos campos: `fase_sla`, `tempo_em_estado_atual_min`, `prazo_fase_min`, `status_sla_inteligente` |
