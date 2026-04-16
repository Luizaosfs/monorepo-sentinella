# SENTINELLA — REVISÃO DE UI/UX POR PERFIL

> Documento de análise qualitativa da experiência de uso para cada perfil.
> Data: 2026-04-02

---

## Metodologia

Para cada perfil foram avaliados:
- Fluxo de entrada (login → home)
- Clareza das telas principais
- Suporte a decisões operacionais
- Pontos de fricção e confusão
- Acessibilidade mobile
- Tratamento de offline/erros
- Criticidade de melhorias antes da implantação

---

## 1. Agente de Campo (`operador`)

### Telas relevantes
- `/agente/hoje` — AgenteHoje.tsx (tela central do dia)
- `/agente/vistoria/:imovelId` — AgenteVistoria.tsx
- `/operador/inicio` — OperadorInicioTurno.tsx
- `/operador/imoveis` — OperadorListaImoveis.tsx
- `/operador/vistoria/:imovelId` — OperadorFormularioVistoria.tsx (stepper)
- `VistoriaSemAcesso.tsx` — fluxo sem acesso

### Pontos positivos
- **Offline-first visível**: banner no topo mostra pendências + count de operações na fila
- **Stepper claro**: 5 etapas com pills de progresso, estado preservado entre etapas
- **Fluxo sem acesso**: modo alternativo bem separado (toca no toggle de entrada → abre VistoriaSemAcesso)
- **GPS checkin automático** na etapa 1 reduz fricção
- **Depósitos A1–E** seguem padrão PNCD do setor — agentes do setor reconhecerão

### Problemas encontrados

#### P1 — CRÍTICO: Duas entradas para o mesmo fluxo de vistoria
`/agente/hoje` e `/operador/inicio` são telas distintas com propósito sobreposto. O agente tem dois caminhos para chegar a uma vistoria (`AgenteVistoria` vs `OperadorFormularioVistoria`). Isso confunde e pode gerar dados duplicados.

**Correção**: Unificar as rotas de agente sob `/agente/*`. O stepper de OperadorFormularioVistoria é mais completo — migrar AgenteVistoria para consumir o mesmo componente.

#### P2 — CRÍTICO: Sem indicação clara de qual imóvel está sendo visitado no stepper
O `OperadorFormularioVistoria` recebe `imovelId` via param mas não exibe endereço/logradouro no cabeçalho persistente das 5 etapas. O agente não tem como confirmar que está no imóvel correto enquanto preenche.

**Correção**: Fixar barra superior com endereço do imóvel + número durante todo o stepper.

#### P3 — ALTO: Contador de pendentes não distingue prioridade
`AgenteHoje` exibe "pendentes: X" mas sem indicar quais têm SLA vencido, quais são revisitas prioritárias, etc. O agente começa o dia sem saber por onde priorizar.

**Correção**: Adicionar badge de cor por urgência (vermelho = SLA crítico, âmbar = revisita, verde = normal) nos cards de imóvel da lista.

#### P4 — ALTO: Modo offline não comunica bem o que foi salvo vs. perdido
O banner offline mostra contagem de pendentes, mas ao coletar dados em campo sem rede, o agente não tem feedback claro de "salvo localmente com sucesso". Pode repetir preenchimento por insegurança.

**Correção**: Toast/snackbar "Salvo offline (ID: XXXX)" imediatamente após FINALIZAR sem rede.

#### P5 — MÉDIO: Lista de imóveis não indica distância nem rota sugerida
`OperadorListaImoveis` exibe cards estáticos sem distância até o imóvel atual (GPS disponível). O agente organiza a rota mentalmente.

**Correção**: Exibir "X metros" (ou "X min a pé") baseado em GPS atual. Mapa já tem TSP em OperadorMapa — linkar com lista.

#### P6 — MÉDIO: Etapa 4 (Tratamento) confunde "eliminados" com "com focos"
Os campos `qtd_eliminados` aparecem após `qtd_com_focos` sem separador visual claro entre "o que foi encontrado" e "o que foi feito". Agentes de campo com baixa literacia digital podem preencher errado.

**Correção**: Separar em dois cards: "O que encontrei" (focos) e "O que fiz" (eliminação + larvicida). Usar cores distintas.

#### P7 — BAIXO: Falta confirmação visual de 3ª tentativa sem acesso
O toast especial na 3ª tentativa (trigger `prioridade_drone=true`) aparece por 3s e desaparece. O agente não sabe que aquele imóvel foi escalado para drone.

**Correção**: Mostrar tela de confirmação dedicada (não apenas toast) informando que o imóvel foi escalado.

### Crítico antes da implantação
- **P1**: Consolidar duplicação agente/operador
- **P2**: Identificação do imóvel no stepper
- **P4**: Feedback offline claro

---

## 2. Gestor Municipal (`supervisor` / `admin`)

### Telas relevantes
- `/gestor/central` — CentralOperacional.tsx
- `/gestor/focos` — GestorFocos.tsx
- `/gestor/focos/:id` — GestorFocoDetalhe.tsx
- `/gestor/mapa` — GestorMapa.tsx
- `/admin/casos` — AdminCasosNotificados.tsx
- `/admin/score-surto` — AdminScoreSurto.tsx
- `/admin/liraa` — AdminLiraa.tsx

### Pontos positivos
- **CentralOperacional** é uma boa home: 4 KPIs clicáveis + alertas urgentes + tabela top imóveis
- **GestorFocos** tem KPI bar + filtros completos + paginação
- **Score territorial** visível nos cards de foco (ScoreBadge)
- **GestorMapa** combina clusters de focos + camada de casos notificados
- **LIRAa** apresenta IIP por quarteirão com cores de risco — útil para relatórios

### Problemas encontrados

#### P1 — CRÍTICO: CentralOperacional não tem botão de atualização manual
Os KPIs têm `refetchInterval: 60s` mas o gestor que acabou de autorizar uma ação quer ver o reflexo imediato. Sem botão "Atualizar agora" ele não sabe se a tela está defasada.

**Correção**: Botão "↻ Atualizar" no header da CentralOperacional + timestamp "Atualizado há X segundos".

#### P2 — CRÍTICO: GestorFocos não exibe o endereço completo na linha da tabela
A tabela mostra bairro + status + prioridade mas trunca o logradouro. Em campo, gestor precisa identificar o imóvel pelo endereço completo para comunicar ao agente por rádio/WhatsApp.

**Correção**: Linha expansível com endereço completo ao clicar, ou coluna de endereço com tooltip.

#### P3 — ALTO: Nenhum atalho rápido para "designar agente a foco"
O gestor vê um foco crítico na CentralOperacional mas não consegue designar um agente sem sair para GestorFocos → GestorFocoDetalhe. São 3–4 cliques para uma ação urgente.

**Correção**: Modal de ação rápida nos cards de top imóveis críticos: "Designar agente" + dropdown de agentes ativos hoje.

#### P4 — ALTO: GestorMapa não tem filtro de tempo persistente
O mapa exibe todos os focos ativos, mas sem filtro de "hoje / esta semana / este ciclo". Um gestor planejando o dia vê focos de meses anteriores misturados.

**Correção**: Filtro de período (hoje / 7d / ciclo atual) que persiste entre sessões via localStorage.

#### P5 — MÉDIO: AdminLiraa não explica o que é IIP ao usuário não técnico
O painel LIRAa usa IIP/IBP sem legenda inline para gestores municipais que não são epidemiologistas. "IIP = 3.8" é opaco sem saber se é bom ou ruim.

**Correção**: Tooltip/acordeão explicativo: "IIP (Índice de Infestação Predial): % de imóveis com Aedes. Seguro < 1%, alerta 1–3.9%, risco > 4%."

#### P6 — MÉDIO: Score de surto sem histórico visual
`AdminScoreSurto` exibe score atual por região mas sem série temporal. Gestor não sabe se o risco está crescendo ou caindo na semana.

**Correção**: Sparkline de 7 dias ao lado de cada região no painel.

#### P7 — BAIXO: Sem notificação push para novos focos de origem cidadão
A Edge Function `notif-canal-cidadao` envia Web Push, mas apenas para gestores com subscription ativa. O fluxo de opt-in para Web Push não é óbvio — não há banner convidando o gestor a habilitar notificações.

**Correção**: Modal de opt-in na primeira visita à CentralOperacional: "Habilitar alertas em tempo real?".

### Crítico antes da implantação
- **P1**: Atualização manual + timestamp
- **P2**: Endereço completo na tabela de focos
- **P3**: Designação rápida de agente

---

## 3. Notificador de Saúde (`notificador`)

### Telas relevantes
- `/notificador/home` — NotificadorHome.tsx
- `/notificador/registrar` — NotificadorRegistroCaso.tsx
- `/notificador/casos` — lista própria de casos

### Pontos positivos
- **KPIs semanais** visíveis na home (confirmados / suspeitos / descartados)
- **Gráfico de pizza** por doença (dengue / chikungunya / zika) claro
- **Barras últimos 14 dias** mostram tendência de notificação
- **"Meus Casos"** separa os casos do notificador logado dos demais

### Problemas encontrados

#### P1 — CRÍTICO: get_meu_papel() não reconhece `notificador` (BUG confirmado)
Conforme identificado na auditoria RLS, a função `get_meu_papel()` não tem `notificador` no CASE. Isso pode fazer o backend retornar papel errado ao notificador, quebrando RLS em tabelas que dependem desta função.

**Correção urgente**:
```sql
WHEN 'notificador' THEN 3
```
Deve ser adicionado ao CASE da função `get_meu_papel()` antes de qualquer implantação.

#### P2 — CRÍTICO: NotificadorHome não tem botão primário visível para registrar caso
A home exibe gráficos mas o botão "Registrar Novo Caso" não está em posição de destaque. Para um usuário que acessa o sistema exclusivamente para notificar, a ação principal deveria ser o elemento mais proeminente da tela.

**Correção**: FAB flutuante "+  Registrar Caso" ou botão primário hero no topo da home, acima dos gráficos.

#### P3 — ALTO: Formulário de registro exige geocodificação Google Maps — falha sem internet
`NotificadorRegistroCaso` usa geocodificação via Google Maps API. Se a UBS tiver rede instável (comum em municípios menores), o endereço não é validado e o formulário fica bloqueado.

**Correção**: Permitir lat/lng manual como fallback quando a geocodificação falha. Exibir campo "Ou insira coordenadas manualmente".

#### P4 — ALTO: Sem feedback quando caso é cruzado com foco automaticamente
O trigger `trg_cruzar_caso_com_focos` age em background. O notificador não sabe se o caso que acabou de registrar cruzou com algum foco e elevou prioridade. Isso seria informação importante para o relato epidemiológico.

**Correção**: Após salvar caso, exibir toast: "✓ Caso registrado. 2 focos próximos identificados — prioridade elevada para Crítico." (baseado no retorno do cruzamento).

#### P5 — MÉDIO: Lista "Meus Casos" sem paginação visível
Se o notificador registra muitos casos, a lista não tem indicação clara de paginação/scroll infinito. Pode parecer que os casos antigos sumiram.

**Correção**: Indicar total de registros + paginação explícita ou "Carregar mais".

#### P6 — MÉDIO: Notificador não tem visão de casos cruzados com focos
Um notificador epidemiologicamente engajado quer saber quais focos estão próximos dos casos que registrou — para alertar o gestor. Essa visão não existe na interface do notificador.

**Correção**: Aba "Focos Próximos" na home do notificador, listando os cruzamentos caso↔foco dos últimos 30 dias.

#### P7 — BAIXO: Sem aviso de duplicata de notificação
Se o mesmo endereço for registrado duas vezes em 24h, o sistema não avisa o notificador antes de salvar (apenas `caso_foco_cruzamento` evita duplicatas no banco, mas não o `casos_notificados`).

**Correção**: Antes de salvar, verificar via RPC se já existe caso no mesmo endereço nas últimas 24h e exibir alerta de confirmação.

### Crítico antes da implantação
- **P1**: BUG em get_meu_papel() — corrigir no banco antes do deploy
- **P2**: Botão de registro em destaque
- **P3**: Fallback de geocodificação

---

## 4. Administrador da Plataforma (`admin`)

### Telas relevantes
- `/admin/*` — todo o painel admin
- `/admin/supervisor-tempo-real` — AdminSupervisorTempoReal.tsx
- `/admin/pipeline-status` — AdminPipelineStatus.tsx
- `/admin/integracoes` — AdminIntegracoes.tsx
- `/admin/score-config` — AdminScoreConfig.tsx
- `/admin/sla` — AdminSla.tsx
- `/admin/usuarios` — AdminUsuarios.tsx

### Pontos positivos
- **Pipeline status** com barra de progresso ao vivo e expansão de erros JSON
- **Score config** com sliders + preview em tempo real bem pensado
- **Supervisor tempo real** com Realtime — agentes aparecem/somem sem refresh
- **Integração e-SUS** com botão de teste de conexão e histórico de envios
- **Painel de municípios** com ranking comparativo e export CSV

### Problemas encontrados

#### P1 — CRÍTICO: Sidebar do admin tem ~30 itens sem agrupamento visual claro
O menu lateral do admin apresenta dezenas de entradas em sequência. Um admin novo passa vários minutos procurando o módulo correto. Não há separação clara entre "operação", "configuração", "auditoria" e "relatórios".

**Correção**: Agrupar sidebar em 4–5 seções com separadores e labels:
- **Operação**: Focos, Vistorias, Casos, Canal Cidadão
- **Análise**: LIRAa, Score Surto, Eficácia, Heatmap
- **Configuração**: Score Config, SLA, Feriados, Integrações
- **Infraestrutura**: Pipeline, Usuários, Quotas, Cloudinary

#### P2 — CRÍTICO: AdminUsuarios exibe todos os usuários do cliente sem paginação server-side
Para municípios com >200 agentes, a lista de usuários pode ser lenta. A query carrega tudo de uma vez.

**Correção**: Paginação server-side + busca por nome/email no banco (não no cliente).

#### P3 — ALTO: Sem tela de saúde do sistema (health check geral)
O admin não tem uma visão consolidada de: Edge Functions com erros recentes, jobs de score presos, quota próxima do limite, pipeline travado. Cada informação está em tela separada.

**Correção**: Tela `/admin/sistema` com checklist de saúde: status das Edge Functions, jobs na fila, erros recentes em `sla_erros_criacao`, corrida de score, quota por cliente.

#### P4 — ALTO: Configuração de SLA por região não tem feedback visual do impacto
`AdminSlaFeriados` e `AdminSla` permitem configurar regras de SLA, mas o admin não vê quantos itens seriam afetados pela mudança antes de salvar.

**Correção**: Preview "Esta alteração afeta X itens com SLA ativo" antes de confirmar.

#### P5 — MÉDIO: AdminIntegracoes não valida formato de API key inline
O campo de API key do e-SUS permite salvar qualquer string sem validação de formato. Erros só aparecem no teste de conexão.

**Correção**: Validação inline no blur do campo (regex de formato esperado para e-SUS).

#### P6 — MÉDIO: Sem auditoria de quem alterou configurações sensíveis
Score config, SLA rules, integrações — mudanças não são logadas. Se algo quebra, o admin não sabe quem alterou o quê.

**Correção**: Tabela `config_audit_log` com `usuario_id`, `tabela`, `campo`, `valor_anterior`, `valor_novo`, `created_at`. Triggers nas tabelas de config.

#### P7 — MÉDIO: Pipeline status não envia alerta quando run trava
`usePipelineRunAtivo` faz polling a cada 10s. Se um run fica preso por >1h, ninguém é notificado.

**Correção**: Edge Function de watchdog: se `pipeline_runs.status = 'running'` há >2h, envia Web Push para admins.

#### P8 — BAIXO: Painel de comparativo entre municípios (`AdminPainelMunicipios`) exige papel específico não documentado
A rota `/admin/painel-municipios` está sob `AdminGuard` genérico, mas o conteúdo (comparação entre clientes) deveria ser exclusivo para `platform_admin` — que está marcado como papel morto no enum. Isso cria inconsistência: a tela existe mas nenhum usuário tem o papel correto para acessá-la com a semântica certa.

**Correção**: Documentar se essa tela é para uso interno da equipe Sentinella (não prefeituras) e proteger com guard adequado ou remover temporariamente.

### Crítico antes da implantação
- **P1**: Reorganização da sidebar admin
- **P2**: Paginação server-side de usuários
- **P3**: Tela de saúde do sistema

---

## 5. Cidadão (canal público)

### Telas relevantes
- `/denuncia/:slug/:bairroId` — DenunciaCidadao.tsx (sem autenticação)
- `/denuncia/consultar` — ConsultaProtocolo.tsx (sem autenticação)

### Pontos positivos
- **Fluxo simples**: descrição + localização + foto — 3 passos
- **Geolocalização automática** reduz fricção de digitar endereço
- **Modo câmera**: captura foto diretamente pelo celular
- **Protocolo único** exibido no sucesso (8 chars do foco_id) — cidadão tem comprovante
- **Consulta de protocolo** sem login — o cidadão pode checar o status depois

### Problemas encontrados

#### P1 — CRÍTICO: Sem feedback do estado da denúncia na consulta de protocolo
`ConsultaProtocolo.tsx` retorna o protocolo encontrado, mas o status exibido é técnico (`suspeita`, `em_triagem`, `confirmado`). O cidadão não entende o que esses estados significam.

**Correção**: Mapear status para linguagem cidadã:
- `suspeita` → "Recebida — aguardando análise"
- `em_triagem` → "Em análise pela equipe"
- `aguarda_inspecao` → "Aguardando visita de campo"
- `confirmado` → "Foco confirmado — ação em andamento"
- `em_tratamento` → "Tratamento em andamento"
- `resolvido` → "Resolvido — obrigado pela denúncia!"
- `descartado` → "Analisado — sem foco identificado no local"

#### P2 — CRÍTICO: DenunciaCidadao não funciona sem JavaScript (não é problema de PWA mas de SEO/compartilhamento)
O link gerado pelo QR code precisa funcionar em browsers antigos e ambientes restritos. A página depende de React completo. Se o JS falha (conexão instável), o cidadão vê tela em branco.

**Correção**: Adicionar mensagem de fallback no `<noscript>`: "Para registrar uma denúncia, ligue para: [telefone da prefeitura]".

#### P3 — ALTO: Ausência de instrução clara sobre o que fotografar
O campo de foto apenas diz "Adicionar foto". Cidadãos podem enviar foto do rosto, da rua errada, ou não enviar nada. A foto é importante para confirmação do foco.

**Correção**: Instrução visual: "Fotografe o local do acúmulo de água ou recipiente suspeito" com ícone de exemplo (caixa d'água, pneu, vaso).

#### P4 — ALTO: Erro de rate limit não é comunicado ao cidadão de forma amigável
O RPC `denunciar_cidadao` tem rate limit de 5 denúncias/min por IP. Se atingido, retorna erro técnico. O frontend não trata este erro com mensagem amigável.

**Correção**: Capturar o erro específico de rate limit e exibir: "Muitas denúncias enviadas em pouco tempo. Aguarde alguns minutos e tente novamente."

#### P5 — ALTO: Sem indicação de prazo de resposta
O cidadão não sabe em quanto tempo a equipe vai agir. A ausência de expectativa pode gerar múltiplas denúncias do mesmo local (tentando "chamar atenção").

**Correção**: Após registrar: "Nossa equipe analisa as denúncias em até 48 horas. Use o protocolo [XXXX] para acompanhar."

#### P6 — MÉDIO: DenunciaCidadao usa slug + bairroId na URL — não é compartilhável genericamente
A URL `denuncia/:slug/:bairroId` inclui `bairroId`, que é UUID interno. Se alguém copiar e compartilhar em grupo de WhatsApp, o link faz denúncias vinculadas ao bairro correto — mas isso não é comunicado ao cidadão que recebe o link.

**Correção**: Exibir "Você está denunciando em: [Nome do Bairro]" no topo da página, antes do formulário.

#### P7 — MÉDIO: Formulário não salva rascunho offline
Se o cidadão preenche o formulário no celular e perde a conexão antes de enviar, todos os dados são perdidos. Não há fila offline para o canal público.

**Correção**: `localStorage` simples para preservar descrição + endereço + coordenadas enquanto o formulário está aberto. Restaurar ao recarregar.

#### P8 — BAIXO: Página de sucesso não tem botão "Denunciar outro local"
Após protocolo exibido, não há call-to-action secundário. Cidadão que viu dois focos diferentes precisa redigitar a URL.

**Correção**: Botão "Fazer outra denúncia" que reinicia o formulário no mesmo bairro.

### Crítico antes da implantação
- **P1**: Linguagem cidadã nos status de protocolo
- **P3**: Instrução sobre o que fotografar
- **P4**: Tratamento amigável de rate limit error
- **P5**: Expectativa de prazo de resposta

---

## Resumo Executivo — Prioridades por Criticidade

### Crítico (bloqueia uso real antes da implantação)

| # | Perfil | Problema | Correção |
|---|--------|----------|----------|
| C1 | Notificador | BUG: `get_meu_papel()` não reconhece papel `notificador` | SQL fix urgente |
| C2 | Agente | Duas entradas paralelas para vistoria (`/agente` vs `/operador`) | Unificar rotas |
| C3 | Agente | Stepper não exibe qual imóvel está sendo vistoriado | Header fixo com endereço |
| C4 | Cidadão | Status de protocolo em linguagem técnica (incompreensível) | Mapear para linguagem cidadã |
| C5 | Gestor | CentralOperacional sem botão de atualização manual | Botão + timestamp |
| C6 | Admin | Sidebar com ~30 itens sem agrupamento | Reorganizar em seções |

### Alto (impacta usabilidade significativamente)

| # | Perfil | Problema |
|---|--------|----------|
| A1 | Agente | Sem feedback offline claro ao finalizar vistoria sem rede |
| A2 | Agente | Lista de imóveis sem indicação de prioridade/urgência |
| A3 | Gestor | Sem atalho rápido para designar agente a foco crítico |
| A4 | Gestor | Mapa sem filtro de período persistente |
| A5 | Notificador | Formulário de registro falha sem geocodificação |
| A6 | Notificador | Sem feedback de cruzamento caso↔foco ao registrar |
| A7 | Cidadão | Sem instrução sobre o que fotografar |
| A8 | Cidadão | Rate limit error sem mensagem amigável |
| A9 | Cidadão | Sem expectativa de prazo de resposta |
| A10 | Admin | Sem paginação server-side em AdminUsuarios |

### Médio (melhoria importante mas não bloqueia MVP)

| # | Perfil | Problema |
|---|--------|----------|
| M1 | Agente | Etapa 4 confunde "encontrado" com "o que foi feito" |
| M2 | Gestor | LIRAa não explica IIP para gestor não técnico |
| M3 | Gestor | Score de surto sem histórico temporal |
| M4 | Notificador | Sem visão de focos próximos aos casos registrados |
| M5 | Admin | Sem auditoria de alterações de configuração |
| M6 | Admin | Pipeline status sem watchdog de run travado |
| M7 | Cidadão | URL com bairroId não comunicada ao cidadão |
| M8 | Cidadão | Formulário não preserva rascunho offline |

---

## Ordem de Implementação Sugerida

### Fase 0 — Antes do primeiro piloto (urgente)
1. **C1** — Fix SQL `get_meu_papel()` + `notificador`
2. **C4** — Linguagem cidadã em ConsultaProtocolo
3. **A8** — Mensagem amigável de rate limit
4. **A5** — Fallback geocodificação manual

### Fase 1 — Primeiras 2 semanas de uso
5. **C2/C3** — Unificação de rotas agente + header de imóvel no stepper
6. **C5** — Botão atualizar + timestamp em CentralOperacional
7. **C6** — Reorganização da sidebar admin
8. **A9** — Prazo de resposta na confirmação de denúncia
9. **A7** — Instrução sobre o que fotografar

### Fase 2 — Após feedback inicial do piloto
10. **A1** — Feedback offline explícito
11. **A2** — Prioridade visual na lista de imóveis
12. **A3** — Designação rápida de agente
13. **A4** — Filtro de período no mapa
14. **M1** — Separação visual etapa 4

### Fase 3 — Estabilização
15. **M3** — Sparkline de score de surto
16. **M5** — Auditoria de config
17. **M6** — Watchdog de pipeline
18. **A10** — Paginação server-side usuários
