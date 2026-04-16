# P1 — Análise Operacional do Sentinella

> Documento gerado com base na leitura direta do código-fonte em `src/`. Toda citação referencia arquivo e linha reais.
> Data de análise: 2026-04-11

---

## 1. Fluxo do Agente

### 1.1 Pontos de Travamento

**T1 — GPS bloqueia o avanço da Etapa 1 por até 8 segundos**

`VistoriaEtapa1Responsavel.tsx` aciona `navigator.geolocation.getCurrentPosition` com `timeout: 8000` ao selecionar "Conseguiu entrar". Durante esse tempo `gettingLocation` é `true` e um spinner é exibido, mas o botão "Próximo" continua disponível — porém o `checkin_em` só é gravado no `onChange` do callback de sucesso. Se o GPS falha silenciosamente (callback de erro chamado), o agente prossegue sem coordenadas, o que é correto. O problema real é a **ausência de feedback legível** durante os 8 s: o spinner aparece dentro do bloco da etapa mas não há texto explicando ao agente o que está acontecendo.

```tsx
// VistoriaEtapa1Responsavel.tsx ~linha 115–135
setGettingLocation(true);
navigator.geolocation.getCurrentPosition(
  (pos) => { onChange({ ...data, lat_chegada: ..., checkin_em: ... }); setGettingLocation(false); },
  () => setGettingLocation(false),   // falha silenciosa
  { timeout: 8000, maximumAge: 30000, enableHighAccuracy: false },
);
```

Ação: exibir `"Obtendo localização… (pode continuar sem GPS)"` em vez de spinner nu.

**T2 — Foto em VistoriaSemAcesso bloqueia submit quando upload falha**

`VistoriaSemAcesso.tsx` invoca `invokeUploadEvidencia` (Cloudinary) antes de chamar `api.vistorias.createCompleta`. Se o upload falhar e o agente estiver online, a função lança exceção, o toast de erro é exibido e a vistoria **não é salva**. A foto é opcional semanticamente, mas o código trata o upload como pré-requisito do submit.

```tsx
// VistoriaSemAcesso.tsx ~linha 155–200 (handleSubmit)
// path online — foto primeiro, vistoria depois
if (fotoFile) {
  const url = await invokeUploadEvidencia(...); // pode lançar
  fotoUrl = url;
}
await api.vistorias.createCompleta({ ..., foto_externa_url: fotoUrl });
```

Ação: envolver o upload em try/catch separado; se falhar, salvar vistoria sem foto e exibir aviso "Foto não enviada — vistoria registrada".

**T3 — `OperadorFormularioVistoria` sem proteção de double-submit**

O botão "Finalizar" na Etapa 5 dispara `handleFinalize` que é uma função `async` que chama `api.vistorias.createCompleta`. Não há flag `isSubmitting` que desabilite o botão durante o envio. Dois toques rápidos podem criar duas vistorias para o mesmo imóvel/ciclo. O `idempotency_key` gerado na fila offline previne duplicatas **no caminho offline**, mas o caminho **online** não gera `idempotency_key` antes de chamar a API.

Ação: adicionar `const [submitting, setSubmitting] = useState(false)` e `disabled={submitting}` no botão de Finalizar.

---

### 1.2 Fricção de UX

**F1 — Seleção de atividade é obrigatória antes de ver a lista de imóveis**

Em `OperadorInicioTurno.tsx`, o agente deve escolher o tipo de atividade (Tratamento / Pesquisa / LIRAa / Ponto Estratégico) na tela inicial antes de navegar para `OperadorListaImoveis`. Porém `AgenteHoje.tsx` apresenta diretamente a lista de imóveis do quarteirão sem essa etapa. Os dois fluxos coexistem — agente e operador veem telas diferentes para a mesma ação. Isso cria confusão quando há troca de perfil ou orientação de supervisores.

**F2 — Etapa Pré (VistoriaEtapaPre) adiciona uma tela extra antes da Etapa 1**

`OperadorFormularioVistoria.tsx` define `ETAPAS_POR_ATIVIDADE` com uma etapa `key: -1` (Registro/Pré) antes das 5 etapas principais. Para o tipo `tratamento`, o stepper tem 6 posições. Para `pesquisa`, 5. Essa inconsistência de contagem de etapas por atividade não é comunicada ao agente: os pills de progresso mudam de quantidade silenciosamente.

**F3 — Campos de Calha (Etapa 3) exigem 3 interações mínimas para cada calha**

`VistoriaEtapa3Inspecao.tsx` exige: toggle `tem_calha` → toggle `calha_inacessivel` → selecionar posição → selecionar condição → toggle `tem_foco`. São 5 interações para registrar uma calha. Em imóveis com múltiplas calhas o agente pode gastar 2–3 minutos só nessa seção.

**F4 — Contador de moradores usa botões +/- sem teclado numérico**

`VistoriaEtapa1Responsavel.tsx` usa botões incrementais para `moradores_qtd`. Em imóvel com 8 moradores o agente precisa de 8 toques. Um input numérico nativo com `type="number"` seria mais rápido.

**F5 — Ausência de atalho "mesmo endereço" ao cadastrar novo imóvel**

`OperadorListaImoveis.tsx` abre um dialog com formulário completo. O GPS preenche lat/lng automaticamente, mas `logradouro`, `numero`, `bairro` e `quarteirao` são digitados manualmente. Em campo, o agente frequentemente cadastra 3–5 imóveis seguidos na mesma rua; não há "reutilizar dados do cadastro anterior".

---

### 1.3 Risco de Erro Humano

**E1 — Status derivado de `getStatusImovel` pode ser contraintuitivo**

`AgenteHoje.tsx` calcula o status do imóvel:
```tsx
// AgenteHoje.tsx ~linha 70–75
if (im.focos_ativos > 0) return 'pendente';
if (im.ultima_visita?.slice(0, 10) === hoje) return 'visitado';
if (im.tentativas_sem_acesso > 0 && im.total_vistorias > 0) return 'revisita';
return 'pendente';
```

Um imóvel visitado hoje **que também tem focos ativos** mostrará status `'pendente'` (vermelho), não `'visitado'` (verde). O agente que acabou de sair do imóvel pode achar que precisa retornar.

**E2 — Motivo "outro" em VistoriaSemAcesso não tem campo de texto obrigatório**

`VistoriaSemAcesso.tsx` aceita `motivo = 'outro'` sem exigir descrição. O banco não valida. O supervisor recebe registros "Outro" sem contexto.

**E3 — Transição de foco sem confirmação de motivo quando em lote**

`GestorFocos.tsx` permite selecionar múltiplos focos e transicioná-los em lote. O campo `loteMotivo` é opcional (`|| undefined`). Um gestor pode transicionar 20 focos para `descartado` por engano sem nenhuma barreira de confirmação além do dialog que já está aberto.

```tsx
// GestorFocos.tsx ~linha 285–291
await api.focosRisco.transicionar(foco.id, statusAlvo, loteMotivo || undefined);
```

**E4 — Rascunho de vistoria é carregado silenciosamente sem pergunta ao agente**

`OperadorFormularioVistoria.tsx` carrega rascunho via `carregarRascunho` e seta `rascunhoPendente`. O agente é informado apenas depois — mas se ele iniciou uma vistoria nova para o mesmo imóvel sem saber que havia rascunho, pode sobrescrever dados recentes sem perceber.

---

### 1.4 Feedback Visual

**V1 — Sem indicador de loading no botão Finalizar (caminho online)**

O `handleFinalize` em `OperadorFormularioVistoria` é `async` mas não reflete estado de carregamento no botão. O agente pode clicar múltiplas vezes ou achar que falhou.

**V2 — OfflineBanner só aparece quando `isOnline === false`**

`OfflineBanner.tsx` retorna `null` quando online. Se o agente voltar a ter sinal e a fila estiver drenando, não há banner de "Enviando X vistorias pendentes…". O `SyncStatusPanel` em `OperadorInicioTurno` preenche parcialmente esse gap, mas não está presente na tela de vistoria em si.

**V3 — Sucesso de vistoria sem retorno ao imóvel na lista**

Após finalizar em `OperadorFormularioVistoria`, o agente é redirecionado para `navigate(-1)`. Se o agente veio de `AgenteHoje`, a lista recarrega via `staleTime: STALE.SHORT` (1 min) — podendo mostrar o imóvel ainda como "pendente" por até 1 minuto.

**V4 — Spinner de GPS sem texto em `OperadorListaImoveis` no dialog de cadastro**

```tsx
// OperadorListaImoveis.tsx ~linha 126–141
navigator.geolocation.getCurrentPosition(
  (pos) => { setForm(prev => ({ ...prev, latitude, longitude })); },
  () => { /* GPS negado — silent fail */ },
  { enableHighAccuracy: false, timeout: 8000 }
);
```
Não há nenhum indicador visual de que o GPS está sendo capturado. O campo lat/lng aparece preenchido "magicamente" — ou não aparece, sem aviso.

---

### 1.5 Melhorias Recomendadas (priorizadas)

| Prioridade | Melhoria | Esforço |
|---|---|---|
| P1 | Proteger botão Finalizar com `disabled={submitting}` | 1h |
| P1 | Upload de foto com fallback: salvar vistoria sem foto se upload falhar | 2h |
| P2 | Texto explicativo no GPS: "Obtendo localização… pode continuar" | 30min |
| P2 | Input `type="number"` para moradores em vez de botões +/- | 1h |
| P2 | Campo texto obrigatório quando motivo sem acesso = "outro" | 1h |
| P3 | Confirmação de quantidade + motivo obrigatório em transições em lote | 2h |
| P3 | "Reutilizar endereço anterior" ao cadastrar imóvel | 3h |
| P3 | Banner "Enviando X pendências…" durante drenagem de fila | 2h |

---

## 2. Fluxo do Supervisor

### 2.1 O que está confuso

**C1 — KPIs da CentralOperacional sem contexto temporal explícito**

`CentralOperacional.tsx` exibe `kpis.focos_ativos`, `kpis.slas_vencendo_2h`, `kpis.vistorias_hoje`, `kpis.agentes_ativos`. Os cards têm subtítulos como "focos ativos" e "hoje", mas não há data/hora visível no card — apenas `lastRefresh` exibido em formato relativo no topo da página. Um gestor que abre a tela às 23h59 e a consulta às 0h01 vê números "de hoje" que já são do dia seguinte.

**C2 — GestorFocos não persiste filtros na URL**

`GestorFocos.tsx` armazena `filtroStatus`, `filtroPrioridade`, `filtroOrigem`, `search`, `page` em `useState` local. Ao navegar para `GestorFocoDetalhe` e voltar (browser back), todos os filtros são perdidos. O supervisor perde o contexto ao investigar um foco específico.

**C3 — Score de surto sem escala de referência**

`ScoreSurtoWidget.tsx` exibe score numérico por região sem informar o range possível (0–100?) nem o que um score de 42 significa em risco real. O widget tem `TrendingUp` no título mas não mostra seta de tendência — se piorou ou melhorou vs. semana anterior.

**C4 — GestorMapa não tem filtro de "focos sem movimentação há N dias"**

`GestorMapaFiltersPanel` tem filtros de status, prioridade, região, score territorial — mas não tem filtro de "inatividade temporal". Focos em `em_tratamento` há 30 dias são invisíveis como prioritários no mapa.

---

### 2.2 O que está escondido

**E1 — Agentes que não fizeram nenhuma vistoria hoje são invisíveis**

`AgentesHojeWidget.tsx` consulta `vistorias` do dia e agrupa por `agente_id`. Agentes escalados que **não iniciaram nenhuma vistoria** simplesmente não aparecem na lista. O supervisor não sabe se o agente está doente, sem celular ou se simplesmente esqueceu de abrir o app.

```tsx
// AgentesHojeWidget.tsx ~linha 36–48
const { data: vistorias } = await supabase
  .from('vistorias')
  .select('id, agente_id, ...')
  .eq('cliente_id', clienteId)
  .gte('created_at', hoje + 'T00:00:00')
  ...
// Agentes sem vistoria hoje → não aparecem na query
```

**E2 — Regiões sem cobertura no ciclo atual não têm destaque**

`AdminDistribuicaoQuarteirao` tem a view `cobertura_quarteirao_ciclo`, mas isso não é surfaced na `CentralOperacional` nem no `GestorMapa`. O gestor precisa navegar para `/admin/distribuicao-quarteirao` explicitamente.

**E3 — SLA vencido aparece na `AdminSla` mas não na `CentralOperacional`**

`useSlaAlerts` detecta SLAs urgentes e emite toasts/push, mas o KPI de `slas_vencendo_2h` na Central não discrimina entre "vai vencer" e "já venceu". O gestor não tem um número de "SLAs já violados hoje".

**E4 — Focos atribuídos a agente específico não têm visão consolidada**

`GestorFocoDetalhe` tem UI para atribuir responsável (`atribuirDialog`). Mas não existe uma tela de "Focos por agente" — o supervisor que quer ver todos os focos do Agente X precisa filtrar manualmente em `GestorFocos`.

---

### 2.3 O que deveria ser automático

**A1 — Escalamento de SLA vencido exige ação manual**

`api.sla.escalar(id)` existe e é chamado manualmente via `AdminSla.tsx`. O `useSlaAlerts` detecta SLAs urgentes mas apenas emite push/toast — não escala automaticamente. SLAs vencidos há mais de 2h ainda aparecem como "vencido" sem escalamento se ninguém clicar.

**A2 — Redistribuição de fila quando agente ausente não existe**

Não há lógica de redistribuição. Se um agente não apareceu, os focos atribuídos a ele ficam em `aguarda_inspecao` indefinidamente. A detecção de ausência (A-E1 acima) já é um problema prévio.

**A3 — Focos parados sem movimento não geram alerta automático**

Não há trigger, cron ou view que marque focos em `em_tratamento` há mais de X dias sem transição. O `score territorial` considera focos ativos, mas não "focos velhos sem progresso".

---

### 2.4 O que falta para decisão

**D1 — Sem comparação de período no dashboard**

`CentralOperacional` mostra KPIs do dia atual. Não há "vs. ontem", "vs. semana passada" ou "vs. mesmo período do ciclo anterior". O gestor não sabe se 12 focos hoje é bom ou ruim.

**D2 — Sem previsão de capacidade**

Não há cálculo de "com X agentes e Y imóveis pendentes, a cobertura do ciclo será atingida em Z dias". Essa informação é calculável com os dados que o Sentinella já tem.

**D3 — Sem tendência de SLA**

`AdminSla.tsx` tem o histórico de SLA, mas não exibe gráfico de "% SLAs cumpridos por semana" para avaliar se a operação está melhorando.

---

### 2.5 Melhorias Recomendadas

| Prioridade | Melhoria | Esforço |
|---|---|---|
| P1 | Incluir agentes escalados (não só com vistorias) no `AgentesHojeWidget` — cruzar com `usuarios WHERE papel='agente' AND ativo=true` | 3h |
| P1 | Persistir filtros de `GestorFocos` na URL via `useSearchParams` | 4h |
| P1 | KPI separado "SLAs já violados" vs "SLAs vencendo em 2h" na Central | 2h |
| P2 | Alerta automático para focos sem transição há mais de 7 dias (cron ou view) | 1 sprint |
| P2 | Comparação "hoje vs. ontem" nos KPIs da CentralOperacional | 1 sprint |
| P3 | Escalamento automático de SLA após 2h de violação (Edge Function) | 1 sprint |
| P3 | Tela "Minha equipe" — focos por agente consolidado | 1 sprint |

---

## 3. Visibilidade Operacional

### 3.1 Scorecard das 4 Perguntas Críticas

**1. O que está atrasado?**

**PARCIAL.** `useSlaAlerts` detecta SLAs urgentes e emite push/toast. `AdminSla.tsx` lista SLAs com destaque visual por status. `CentralOperacional` tem o card `slas_vencendo_2h` com borda vermelha quando `> 0`. Porém: (a) não há diferenciação visual entre "vai vencer" e "já venceu/violado", (b) a contagem não aparece no menu lateral como badge, (c) SLAs de focos sem levantamento_item vinculado não aparecem no painel principal.

**2. Quem está sobrecarregado?**

**NÃO.** `AgentesHojeWidget` mostra total de vistorias por agente vs. meta de 15 (`META_DIARIA = 15`), com barra de progresso. Isso indica sobrecarga por volume. Mas: (a) agentes sem nenhuma vistoria são invisíveis, (b) não há peso por complexidade de imóvel (imóvel com 3 focos ≠ imóvel limpo), (c) não há visão de fila pendente por agente.

**3. Quais regiões estão críticas?**

**PARCIAL.** `GestorMapa` tem camada de cluster de focos com cores por prioridade e filtro por `scoreClassificacao`. `ScoreSurtoWidget` lista top 3 regiões por score preditivo. Porém não há "região sem cobertura no ciclo" destacada no mapa — apenas focos confirmados aparecem.

**4. Quais focos estão parados?**

**NÃO.** Não existe filtro, view, KPI ou alerta para "focos em `em_tratamento` há mais de N dias sem movimentação". O `foco_risco_historico` tem os dados necessários (`alterado_em`), mas nenhuma consulta ou interface os usa para isso. É o gap operacional mais crítico — focos podem ficar travados indefinidamente sem visibilidade.

---

### 3.2 KPIs Ausentes

| KPI | Impacto | Fonte de dados disponível |
|---|---|---|
| Focos parados > 7 dias sem transição | Alto | `foco_risco_historico.alterado_em` |
| % SLAs cumpridos no ciclo atual | Alto | `sla_operacional` |
| Agentes escalados sem check-in hoje | Alto | `usuarios` + `vistorias` |
| Cobertura de quarteirão no ciclo (%) | Médio | `v_liraa_quarteirao` + `quarteiroes` |
| Focos resolvidos hoje vs. criados hoje (delta) | Médio | `focos_risco` |
| Tempo médio ciclo suspeita→resolução | Baixo | `foco_risco_historico` |

---

### 3.3 Alertas Recomendados

| Alerta | Gatilho | Canal |
|---|---|---|
| Foco parado | `em_tratamento` há > 7 dias sem `alterado_em` recente | Badge no menu + push |
| Agente ausente | Agente escalado sem vistoria até 10h | Push para supervisor |
| Região descoberta | Quarteirão sem visita no ciclo atual | Toast diário |
| SLA violado | `prazo_final < now() AND status IN ('pendente','em_atendimento')` | Badge vermelho persistente |
| Cluster de casos | ≥ 3 casos notificados no mesmo bairro em 7 dias | Alerta na CentralOperacional |

---

## 4. Erros Reais de Campo

### 4.1 Cenário A — Agente sem internet

**Fluxo:**
1. `AgenteHoje.tsx` carrega dados de `imóveis_do_agente` via React Query. Se offline, usa cache do staleTime (dados do último online).
2. Agente navega para `OperadorFormularioVistoria`. O formulário funciona localmente — estado é gerenciado em memória + rascunho via `vistoriaRascunho` (IndexedDB/localStorage).
3. Ao finalizar, `handleFinalize` detecta `!navigator.onLine` (ou a chamada API falha) e chama `enqueue({ type: 'save_vistoria', payload: {...} })`.
4. A fila IndexedDB (`sentinela-offline`, store `operations`) persiste o payload completo incluindo depósitos, sintomas, riscos.

**O que fica para trás:**
- Foto de evidência: em `VistoriaSemAcesso.tsx` o path offline pula o upload (`foto e upload ignorados sem rede`) e salva `foto_externa_url: null` no payload. A vistoria é enfileirada sem foto.
- Assinatura digital: não há tratamento explícito para offline no upload de assinatura (`assinatura_responsavel_url`).
- `idempotency_key` é gerado via `crypto.randomUUID()` antes de enfileirar — garante que ao drenar não haja duplicata no servidor (a RPC `createCompleta` usa upsert por idempotency_key).

**Conclusão:** fluxo offline funcional para dados estruturados; fotos e assinaturas são perdidas silenciosamente.

---

### 4.2 Cenário B — Envio duplicado

**Deduplicação presente:**

```tsx
// offlineQueue.ts ~linha 144–157 (enqueue)
const opWithKey = op.type === 'save_vistoria' && !op.payload.idempotency_key
  ? { ...op, payload: { ...op.payload, idempotency_key: crypto.randomUUID() } }
  : op;
```

O `idempotency_key` é gerado no `enqueue` se não vier do caller. A RPC `api.vistorias.createCompleta` (no servidor) deve usar esse key para upsert — o que previne duplicata no banco.

**Lacuna:** o caminho online direto (`handleFinalize` quando conectado) não gera `idempotency_key` antes de chamar `api.vistorias.createCompleta`. Dois toques rápidos online (T3 de §1.1) podem gerar duas vistorias. Não há verificação no banco de "já existe vistoria para (imovel_id, agente_id, ciclo, data_visita)" além do idempotency_key.

---

### 4.3 Cenário C — GPS indisponível

**`VistoriaEtapa1Responsavel.tsx`:**
- Callback de erro em `getCurrentPosition` chama apenas `() => setGettingLocation(false)` — sem mensagem, sem bloquear avanço.
- O agente pode prosseguir sem GPS: `lat_chegada` e `lng_chegada` ficam `null`.
- O banco aceita `null` nessas colunas.

**`SemAcessoWrapper` em `AgenteVistoria.tsx`:**
- GPS coletado em `useEffect` com `enableHighAccuracy: false, timeout: 8000`.
- Falha silenciosa: `() => {}`.
- Formulário não bloqueia.

**`OperadorListaImoveis.tsx` (cadastro de imóvel):**
- GPS tentado ao abrir dialog, falha silenciosa.
- `latitude: null, longitude: null` são aceitos no cadastro.

**Conclusão:** GPS não bloqueia nenhum fluxo. Porém: (a) agente não é informado que a localização não foi capturada — dados aparecem sem indicador de ausência de coordenadas; (b) imóveis cadastrados sem GPS não têm marcador no mapa.

---

### 4.4 Cenário D — Foto não enviada

**Path online (`VistoriaSemAcesso.tsx`):**
```tsx
// handleSubmit — path online
if (fotoFile) {
  const url = await invokeUploadEvidencia(...); // lança se falhar
  fotoUrl = url;
}
await api.vistorias.createCompleta({ ..., foto_externa_url: fotoUrl });
```
Se `invokeUploadEvidencia` lança, o `catch` exibe toast de erro e **a vistoria não é salva**. O agente fica preso: tem foto mas não consegue enviar, e a vistoria sem foto não é registrada.

**Path offline:** foto é ignorada, `foto_externa_url: null`, vistoria enfileirada sem foto. Ao drenar, a vistoria é criada sem foto — não há tentativa de re-upload.

**Conclusão:** o comportamento mais seguro (salvar vistoria sem foto) só ocorre offline. Online, uma falha de upload impede o registro inteiro. Correto seria: salvar a vistoria primeiro, tentar o upload depois, atualizar `foto_externa_url` se bem-sucedido.

---

### 4.5 Cenário E — Sincronização parcial

**`drainQueue` em `offlineQueue.ts`:**

A função itera sobre operações pendentes ordenadas por `createdAt`. Para cada operação:
- Se bem-sucedida: remove da fila.
- Se falhar: incrementa `retryCount`. Quando `retryCount >= MAX_RETRIES` (3), a operação vira "dead-letter" e é filtrada por `isExpired` / `getPendingCount`.

**O que acontece com inconsistência:**
- Operações anteriores já enviadas com sucesso são removidas da fila — não há rollback.
- A operação que falhou permanece com `retryCount` incrementado.
- Operações posteriores na fila **continuam sendo processadas** — `drainQueue` não para na primeira falha.

**Risco real:** se uma vistoria (op 1) for enviada com sucesso mas os depósitos (op 2, operação separada para item legado `checkin`) falharem, o estado no banco fica com vistoria sem depósitos. Para o novo fluxo `save_vistoria` isso é atômico (RPC transacional) — mas para `checkin` e `update_atendimento` (operações separadas) não há garantia de atomicidade.

**Conclusão:** para `save_vistoria` (fluxo principal atual): seguro, pois é transacional. Para `checkin` + `update_atendimento` (itens legados): risco de estado parcial permanece.

---

## 5. Diferencial de Mercado

### 5.1 Rota Inteligente com SLA como Critério de Ordenação

**O que é:** o `OperadorMapa.tsx` já implementa TSP nearest-neighbor para ordenar imóveis. A melhoria é incorporar o SLA do foco vinculado ao imóvel como peso: imóveis com foco próximo do vencimento de SLA sobem na rota, independentemente da distância.

**Por que é difícil de copiar:** requer o histórico de SLA por imóvel (disponível em `sla_operacional`), o score territorial (disponível em `territorio_score`) e a posição GPS em tempo real do agente — tudo já coletado pelo Sentinella. Um app genérico de vistoria ou planilha Excel não tem esses dados integrados.

**Impacto:** reduz violações de SLA prioritárias. O supervisor vê menos "focos críticos não atendidos" no fim do dia. Estimativa: 1 sprint (rota já existe, só mudar função de peso).

---

### 5.2 Diagnóstico Preditivo de Imóvel Reincidente

**O que é:** para imóveis com ≥ 2 focos confirmados nos últimos 60 dias (já detectados pelo `ReincidenteBanner` em `AgenteVistoria.tsx`), gerar automaticamente um "perfil de risco" com: tipo de depósito mais frequente, horário de acesso com maior taxa de sucesso, histórico de larvicida aplicado. Exibir como card antes do stepper de vistoria.

**Por que é difícil de copiar:** usa dados de `vistoria_depositos`, `focos_risco`, `vistoria_calhas` e `imoveis.perfil` — dados exclusivos do histórico operacional acumulado pelo Sentinella naquele município. Nenhum sistema começa com essa profundidade de histórico.

**Impacto:** agente vai ao imóvel sabendo exatamente o que procurar e qual depósito eliminar primeiro. Reduz tempo médio de vistoria em imóveis críticos e aumenta taxa de resolução definitiva. Estimativa: 2 sprints (análise dos dados existentes + UI de card pré-vistoria).

---

### 5.3 Fechamento de Ciclo com Relatório Automático para a Prefeitura

**O que é:** ao final de cada ciclo LIRAa (a cada 2 meses), gerar automaticamente um boletim consolidado com: IIP por quarteirão, comparação com ciclo anterior, focos resolvidos vs. pendentes, agentes por produtividade, imóveis críticos para o próximo ciclo. Enviado por e-mail ao gestor e disponível como PDF assinável.

**Por que é difícil de copiar:** integra `v_liraa_quarteirao`, `v_eficacia_tratamento`, `rpc_score_surto_regioes`, `rpc_comparativo_agentes` e `resumos_diarios` — views e RPCs que levam meses para acumular dados reais. A Edge Function `relatorio-semanal` já existe; a extensão para ciclo completo é natural.

**Impacto direto para a prefeitura:** substitui o trabalho manual de consolidar planilhas no final do ciclo. Secretarias de saúde exigem esse relatório para o Ministério da Saúde. Quem usa o Sentinella gera isso em 1 clique; quem usa planilha leva 2 dias. Estimativa: 1 sprint (dados já existem, falta a composição e o template PDF do boletim LIRAa oficial).

---

## 6. Backlog de Melhorias

### UX (ordenado por impacto)

1. **Botão Finalizar com proteção de double-submit** — `OperadorFormularioVistoria.tsx` — 1h
2. **Upload de foto com fallback: registrar vistoria sem foto se upload falhar** — `VistoriaSemAcesso.tsx` — 2h
3. **Texto no GPS: "Obtendo localização… pode continuar"** — `VistoriaEtapa1Responsavel.tsx` — 30min
4. **Input numérico para moradores** (tipo `number`) — `VistoriaEtapa1Responsavel.tsx` — 1h
5. **Campo obrigatório "descreva o motivo" quando motivo = 'outro'** — `VistoriaSemAcesso.tsx` — 1h
6. **Persistir filtros de GestorFocos na URL** (`useSearchParams`) — `GestorFocos.tsx` — 4h
7. **Banner "Enviando X pendências…" durante drenagem** — `useOfflineQueue.ts` + `OfflineBanner.tsx` — 2h
8. **"Reutilizar endereço anterior" ao cadastrar imóvel** — `OperadorListaImoveis.tsx` — 3h
9. **Confirmação obrigatória com campo motivo nas transições em lote** — `GestorFocos.tsx` — 2h
10. **Indicador visual de GPS não capturado** (ícone + tooltip) — `VistoriaEtapa1Responsavel.tsx` — 1h

### Gestão (ordenado por impacto)

1. **KPI "Focos parados > 7 dias"** na CentralOperacional — view sobre `foco_risco_historico` — 1 sprint
2. **Agentes escalados sem check-in** no `AgentesHojeWidget` — cruzar `usuarios` com `vistorias` — 3h
3. **KPI "SLAs já violados" separado de "vencendo em 2h"** — CentralOperacional — 2h
4. **Tendência nos KPIs: "vs. ontem" / "vs. semana"** — CentralOperacional — 1 sprint
5. **Escalamento automático de SLA vencido** após 2h — Edge Function — 1 sprint
6. **Tela "Focos por agente"** — visão de carga individual — 1 sprint
7. **Score de surto com seta de tendência** — `ScoreSurtoWidget.tsx` — 4h
8. **Mapa com destaque de regiões sem cobertura no ciclo** — `GestorMapa.tsx` — 1 sprint
9. **Filtro de focos por inatividade temporal no mapa** — `GestorMapaFiltersPanel` — 3h
10. **Gráfico "% SLAs cumpridos por semana"** em AdminSla — 1 sprint

### Campo (ordenado por impacto)

1. **Rota com SLA como peso** (focos urgentes sobem na fila de visita) — `OperadorMapa.tsx` — 1 sprint
2. **Card de diagnóstico de imóvel reincidente** antes do stepper — `AgenteVistoria.tsx` — 2 sprints
3. **Boletim automático de fechamento de ciclo LIRAa** — Edge Function + PDF — 1 sprint
4. **Upload de foto com retry automático ao reconectar** (offline → re-upload de foto pendente) — `offlineQueue.ts` — 1 sprint
5. **Atalho "Sem acesso rápido"** diretamente na lista de imóveis (sem abrir vistoria completa) — `AgenteHoje.tsx` — 3h
6. **Preview de foto antes de submeter** (confirmar que foto é legível) — `VistoriaSemAcesso.tsx` — 2h
7. **Contador de tentativas sem acesso visível na lista** com alerta de "3ª tentativa → notificação formal" — `AgenteHoje.tsx` — 2h
8. **Cadastro de imóvel por QR code/geofence** (imóvel detectado ao aproximar-se) — 2 sprints
