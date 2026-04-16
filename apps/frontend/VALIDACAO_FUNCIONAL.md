# VALIDAÇÃO FUNCIONAL POR PERFIL — SENTINELLA
**Objetivo:** Garantir que cada perfil consegue operar de forma autônoma.
**Como usar:** Execute cada item em ambiente real com usuário de teste. Marque ✅ ao concluir ou ❌ se falhar (anotar o problema).

---

## PERFIL: ADMIN (plataforma)
> Papel: `admin` | Rota inicial: `/admin/clientes`

### Acesso e navegação
- [ ] Login com credenciais de admin
- [ ] Redireciona automaticamente para `/admin/clientes`
- [ ] Sidebar mostra apenas itens de plataforma (Clientes, Sistema, Jobs, Quotas)
- [ ] **NÃO** aparece menu de operação (Focos, Mapa, Central, Agentes)

### Gestão de clientes
- [ ] Criar nova prefeitura (nome, UF, IBGE 7 dígitos)
- [ ] Confirmar seed automático: `sla_config`, `score_config`, `cliente_quotas`, feriados nacionais
- [ ] Editar prefeitura existente
- [ ] Listar todas as prefeituras cadastradas

### Gestão de usuários
- [ ] Criar supervisor para uma prefeitura
- [ ] Criar agente de campo
- [ ] Criar notificador
- [ ] Alterar papel de usuário existente
- [ ] Desativar usuário (`ativo = false`)

### Plataforma
- [ ] Acessar `/admin/saude-sistema` — ver status de serviços
- [ ] Acessar `/admin/job-queue` — ver fila de jobs
- [ ] Acessar `/admin/quotas` — ver e editar limites por cliente
- [ ] Acessar `/admin/clientes` — **supervisor NÃO consegue acessar esta rota** (testar com login de supervisor)

### Isolamento multi-tenant
- [ ] Admin vê dados de TODOS os clientes em `/admin/clientes`
- [ ] Admin NÃO vê dados operacionais de nenhum cliente específico (focos, vistorias, etc.)

---

## PERFIL: SUPERVISOR (gestor municipal)
> Papel: `supervisor` | Rota inicial: `/gestor/central`

### Acesso e navegação
- [ ] Login com credenciais de supervisor
- [ ] Redireciona automaticamente para `/gestor/central`
- [ ] Vê apenas dados do próprio cliente (multitenancy)
- [ ] Tentar acessar `/admin/clientes` → redireciona para `/gestor/central` ✋
- [ ] Tentar acessar `/admin/saude-sistema` → redireciona para `/gestor/central` ✋
- [ ] Tentar acessar `/admin/job-queue` → redireciona para `/gestor/central` ✋

### Central do Dia
- [ ] KPIs carregam (focos, SLA, vistorias, agentes, denúncias)
- [ ] Top imóveis críticos aparecem com ScoreBadge
- [ ] Widget de agentes em campo (AgentesHojeWidget)
- [ ] Botão "Planejar hoje" navega para o mapa

### Focos de Risco
- [ ] Lista de focos com filtros (status, prioridade, origem)
- [ ] Transicionar foco: suspeita → triagem → confirmado → resolvido
- [ ] Ver timeline de cada foco
- [ ] Ver foco no detalhe com casos próximos (banner 300m)
- [ ] Adicionar observação a um foco (campo implementado na auditoria)

### Mapa
- [ ] Focos aparecem no mapa por prioridade/cor
- [ ] Filtros por classificação de score funcionam
- [ ] Heatmap temporal (slider de semanas)
- [ ] Mapa antes/depois (dois levantamentos)

### SLA
- [ ] Lista de SLAs por prioridade
- [ ] Receber push de SLA crítico (≤1h restante)
- [ ] Ver auditoria de SLA (timeline criado→atendimento→resolvido)

### LIRAa
- [ ] Selecionar ciclo → ver IIP/IBP por quarteirão
- [ ] Tabela colorida por classificação de risco
- [ ] Exportar boletim PDF

### Score Territorial
- [ ] Ver distribuição de score por bairro
- [ ] Forçar recálculo de score
- [ ] Configurar pesos em `/admin/score-config`

### Relatórios
- [ ] Receber e-mail de relatório semanal (verificar caixa de entrada)
- [ ] Gerar PDF de relatório de levantamento
- [ ] Ver resumo diário no dashboard

### Notificações push
- [ ] Autorizar notificações no navegador
- [ ] Receber push quando cidadão cria denúncia
- [ ] Receber push de SLA crítico

---

## PERFIL: OPERADOR / AGENTE
> Papel: `operador` | Rota inicial: `/agente/hoje`

### Acesso e navegação
- [ ] Login com credenciais de agente
- [ ] Redireciona para `/agente/hoje`
- [ ] Vê apenas seus imóveis e vistorias
- [ ] Tentar acessar `/admin/*` ou `/gestor/*` → redireciona ✋

### Meu Dia (`/agente/hoje`)
- [ ] Stats do ciclo carregam (pendentes, visitados, cobertura)
- [ ] Seleção de tipo de atividade (Tratamento / Pesquisa / LIRAa / Ponto Estratégico)
- [ ] Banner offline aparece se houver vistorias pendentes de envio

### Lista de Imóveis (`/operador/imoveis`)
- [ ] Lista carrega com status por cor (vermelho=pendente, verde=visitado)
- [ ] Filtro por rua/bairro/quarteirão funciona
- [ ] Cadastro rápido de novo imóvel via dialog

### Vistoria completa (`/operador/vistoria/:imovelId`)
- [ ] **Etapa 1 — Responsável:** GPS capturado automaticamente, contador de moradores, toggles grávidas/idosos/crianças
- [ ] **Etapa 2 — Sintomas:** toggles febre/manchas/articulações/cabeça, banner caso suspeito
- [ ] **Etapa 3 — Inspeção:** depósitos A1–E com inspecionados + focos
- [ ] **Etapa 4 — Tratamento:** eliminados + toggle larvicida + qtd_larvicida_g
- [ ] **Etapa 5 — Riscos:** riscos social/sanitário/vetorial + FINALIZAR
- [ ] Tela de sucesso após finalizar
- [ ] Status do imóvel atualiza para "visitado"

### Sem acesso
- [ ] Toggle "Conseguiu entrar?" → ativa fluxo sem acesso
- [ ] Selecionar motivo (ausente, cachorro, recusa…)
- [ ] Registrar calha visível de fora (posição, condição, foco)
- [ ] Selecionar horário de retorno
- [ ] Toast especial na 3ª tentativa (imóvel marcado para drone)

### Offline
- [ ] Desligar conexão → continuar fazendo vistoria
- [ ] Banner "Modo offline" aparece com contagem de pendentes
- [ ] Religar conexão → vistorias sincronizam automaticamente
- [ ] Toast de confirmação de sincronização

### Mapa do operador (`/operador/mapa`)
- [ ] Imóveis aparecem no mapa
- [ ] Rota otimizada (TSP nearest-neighbor) calculada
- [ ] Botão abre Google Maps com waypoints

---

## PERFIL: NOTIFICADOR (unidade de saúde)
> Papel: `notificador` | Rota inicial: `/notificador/registrar`

### Acesso e navegação
- [ ] Login com credenciais de notificador
- [ ] Redireciona para `/notificador/registrar`
- [ ] Tentar acessar `/admin/*` ou `/gestor/*` → redireciona ✋

### Registro de caso
- [ ] Formulário de novo caso abre
- [ ] Selecionar doença (dengue / chikungunya / zika / suspeito)
- [ ] Selecionar status (suspeito / confirmado)
- [ ] Preencher endereço → geocodificação funciona (coordenadas preenchidas)
- [ ] Selecionar unidade de saúde
- [ ] **NÃO** pede nome, CPF ou data de nascimento do paciente (LGPD ✋)
- [ ] Salvar → caso criado
- [ ] Cruzamento automático com focos próximos (trigger PostGIS 300m) ocorre em background

### Lista de casos
- [ ] Ver casos do próprio cliente em `/notificador`
- [ ] Filtrar por status / doença / data
- [ ] Confirmar ou descartar caso

### Cruzamento caso ↔ foco
- [ ] Criar caso próximo a um foco existente (< 300m)
- [ ] Verificar em `/gestor/focos` se foco teve prioridade elevada para P1
- [ ] Verificar banner de casos próximos no detalhe do foco

---

## PERFIL: CIDADÃO (sem login)
> Acesso público | Rota: `/denuncia/:slug/:bairroId`

### Denúncia
- [ ] Abrir link público sem estar logado
- [ ] Formulário aparece sem solicitar cadastro
- [ ] Preencher tipo de problema e endereço
- [ ] Submeter → receber protocolo (8 primeiros chars do `foco_id`)
- [ ] Protocolo exibido claramente na tela

### Rate limit
- [ ] Submeter 6 denúncias em menos de 1 minuto → 6ª é bloqueada com mensagem de erro ✋

### Consulta de protocolo
- [ ] Acessar `/denuncia/consultar`
- [ ] Digitar protocolo recebido → ver status do foco
- [ ] Protocolo inválido → mensagem clara de "não encontrado"

---

## RESULTADO DA VALIDAÇÃO

| Perfil | Total itens | ✅ OK | ❌ Falhou | Observações |
|---|---|---|---|---|
| Admin | | | | |
| Supervisor | | | | |
| Operador | | | | |
| Notificador | | | | |
| Cidadão | | | | |

**Data da validação:** ___________
**Ambiente:** ___________
**Validado por:** ___________
