# PLANO DE EXECUÇÃO DO PILOTO — SENTINELLA
**Versão:** 1.0 — Abril 2026
**Destinatário:** Secretaria de Saúde / Vigilância Ambiental
**Classificação:** Documento operacional — uso interno

---

## 1. OBJETIVO DO PILOTO

### O que a prefeitura precisa validar

- Se o sistema elimina o registro em papel e planilha nas vistorias de campo
- Se o supervisor consegue gerenciar a operação sem ligar para os agentes
- Se os dados coletados em campo chegam ao sistema antes do fim do dia
- Se é possível saber, em tempo real, quantos focos estão sendo trabalhados
- Se a rastreabilidade é suficiente para auditorias da vigilância epidemiológica

### O que o Sentinella precisa provar

- Que agentes de campo conseguem operar com smartphone sem treinamento extenso
- Que o fluxo foco → inspeção → resolução funciona no mundo real (não só em demo)
- Que o supervisor ganha visibilidade real sobre o trabalho de campo
- Que os relatórios gerados ao final do ciclo têm valor para a gestão municipal
- Que o sistema opera com falhas de rede (campo sem sinal)

### Definição de sucesso

O piloto será considerado **bem-sucedido** se, ao final de 45 dias:

1. ≥ 80% das vistorias realizadas nos bairros do piloto estiverem registradas no sistema
2. Supervisor usar o dashboard diariamente (verificado por logs de acesso)
3. ≥ 1 reunião gerencial com relatório gerado pelo sistema
4. Tempo médio entre criação de foco e inspeção for medido e documentado
5. Prefeitura manifestar interesse em expandir para outros bairros ou contratar

---

## 2. ESCOPO DO PILOTO

### Recorte territorial recomendado

| Parâmetro | Valor sugerido | Justificativa |
|---|---|---|
| Bairros | 3 a 5 | Controlável, representativo |
| Imóveis mapeados | 500 a 1.500 | Suficiente para gerar dados |
| Agentes de campo | 3 a 5 | Um por bairro |
| Supervisores | 1 a 2 | Um principal + um backup |
| Notificadores | 1 (UBS local) | Opcional no piloto |
| Canal cidadão | Opcional | Ativar apenas se houver QR impresso |
| Drones | **NÃO no piloto** | Aumenta complexidade sem necessidade imediata |
| Integração e-SUS | **NÃO no piloto** | Homologação separada, posterior |

### Perfis de usuário do piloto

| Perfil | Qtd | Papel no sistema |
|---|---|---|
| Coordenador de vigilância | 1 | Admin local — configura e acompanha |
| Supervisor de campo | 1–2 | Gestor — triagem, SLA, relatórios |
| Agente de controle de endemias | 3–5 | Operador — vistoria em campo |
| Enfermeiro/UBS | 0–1 | Notificador — registro de casos (opcional) |

---

## 3. CRONOGRAMA — 45 DIAS

### SEMANA 0 — Setup Técnico (Dias 1–5)
**Responsável:** Equipe Sentinella

| Atividade | Responsável | Entrega |
|---|---|---|
| Cadastrar prefeitura no sistema (UF, IBGE, bairros, regiões) | Equipe Sentinella | Sistema configurado |
| Criar usuários (admin, supervisor, agentes, notificador) | Equipe Sentinella | Logins funcionando |
| Importar ou cadastrar imóveis dos bairros do piloto | Equipe Sentinella + coord. vigilância | ≥ 500 imóveis |
| Configurar feriados locais e SLA base | Equipe Sentinella | SLA calculando |
| Criar 3 a 5 focos de teste para validação | Equipe Sentinella | Focos em ambiente de produção |
| Validar login de todos os perfis | Equipe Sentinella + coord. | Checklist assinado |

**Critério de conclusão:** todos os usuários logam, veem seu papel correto, um foco passa pelo fluxo completo.

---

### SEMANA 1 — Treinamento (Dias 6–12)
**Responsável:** Equipe Sentinella + Coord. vigilância

**Dia 1 — Treinamento do Supervisor (manhã, 3h)**
- Central Operacional: KPIs, fila, execução
- Triagem de focos: criar, atribuir agente, mover na fila
- Mapa operacional: filtros, status
- SLA: como ler, quando escalar
- Relatórios disponíveis
- *Prática guiada:* criar foco, atribuir, acompanhar no mapa

**Dia 2–3 — Treinamento dos Agentes (manhã, 2h por turma)**
- Tela "Meu Dia": o que aparece, por que
- Iniciar inspeção: botão, o que acontece
- 5 etapas da vistoria: prática no celular
- Sem acesso ao imóvel: como registrar
- Offline: o que o banner significa
- *Prática guiada:* fazer vistoria completa de um imóvel real
- *Erro mais comum:* fechar app antes de finalizar → explicar que dados estão salvos

**Dia 4 — Treinamento do Notificador (1h, opcional)**
- Registrar caso: campos obrigatórios, LGPD
- Visualizar cruzamento com focos

**Dias 5–7 — Operação Simulada (piloto no escritório)**
- Supervisor cria focos, atribui agentes
- Agentes fazem vistorias em campo (rua próxima)
- Supervisor acompanha em tempo real
- Tirar dúvidas reais antes da operação oficial

---

### SEMANAS 2–5 — Operação Assistida (Dias 13–42)
**Responsável:** Equipe Sentinella (suporte) + coord. vigilância (operação)

**Rotina de suporte da equipe Sentinella:**
- Verificação diária: fila offline drenada, sem erros críticos em `sla_erros_criacao`, focos P1 sem agente
- Reunião rápida (15min) com supervisor 3x por semana nas primeiras 2 semanas
- Reduzir para 1x por semana nas semanas 4 e 5
- Canal WhatsApp/Slack para dúvidas urgentes

**Marco da semana 3:** gerar primeiro relatório de ciclo com o supervisor. Apresentar para o coordenador de vigilância. Coletar feedback.

**Marco da semana 5:** gerar relatório comparativo (bairros cobertos × focos encontrados × resolvidos × SLA).

---

### SEMANA 6 — Avaliação e Decisão (Dias 43–45)
**Responsável:** Equipe Sentinella + gestão da prefeitura

| Atividade | Duração |
|---|---|
| Gerar relatório final do piloto (dados do sistema) | 1 dia |
| Reunião de apresentação com secretaria de saúde | 2h |
| Coleta de feedback formal | 30min |
| Proposta de contrato / expansão | A definir |

---

## 4. ROTINA DO SUPERVISOR

### Todo dia (manhã — 15 minutos)

1. Abrir **Central Operacional** → ler os KPIs do dia
   - Quantos focos pendentes, em inspeção, em atendimento
   - SLAs vencendo nas próximas 2h
   - Focos P1 sem agente atribuído (campo vermelho → ação imediata)
2. Abrir **Triagem** → mover suspeitas novas para fila de inspeção e atribuir agente
3. Ver **Mapa** → chips filtrados por `aguarda_inspecao` e `em_inspecao`
4. Checar **fila de agentes** — alguém sem focos atribuídos hoje?

### Todo dia (tarde — 10 minutos)

1. Ver **produtividade do dia** — vistorias realizadas
2. Verificar se algum foco `em_inspecao` ficou parado (agente não finalizou)
3. Reagendar ou reatribuir se necessário

### Toda semana (sexta, 30 minutos)

1. Abrir **AdminProdutividadeAgentes** → ver comparativo da semana
2. Abrir **AdminLiraa** (se ciclo ativo) → ver IIP por quarteirão
3. Criar reinspeções para focos com recorrência alta
4. Verificar **SLA vencidos** → escalar ou encerrar
5. Gerar PDF de relatório semanal ou usar o enviado automaticamente por e-mail

### Sinais de alerta que exigem ação imediata

| Sinal | Ação |
|---|---|
| `focos_p1_sem_agente > 0` | Atribuir agente antes do fim do dia |
| SLA crítico (≤ 1h) com notificação push | Ligar para agente / reatribuir |
| Agente sem vistoria há 2 dias | Verificar se há problema técnico |
| Bairro com score > 80 no ScoreSurto | Criar planejamento emergencial |

---

## 5. ROTINA DO AGENTE

### Todo dia ao iniciar o turno (5 minutos)

1. Abrir o Sentinella → tela **"Meu Dia"**
2. Ver focos atribuídos: endereço, prioridade, SLA
3. Verificar se há **alertas de retorno** (imóvel com revisita pendente)
4. Checar sinal de rede — se fraco, saber que o modo offline está ativo

### Para cada foco atribuído

1. Tocar em **"Iniciar inspeção"** antes de sair para o endereço
   - *(Isso registra que a inspeção começou — não pular este passo)*
2. Chegar no imóvel
3. **Conseguiu entrar?**
   - Sim → seguir as 5 etapas da vistoria
   - Não → usar fluxo "Sem acesso": registrar motivo, horário sugerido, foto da fachada
4. Ao finalizar → tocar **"Finalizar vistoria"**
5. Aguardar confirmação na tela antes de fechar o app

### Fim do turno (5 minutos)

1. Verificar banner de sincronização — não sair do Wi-Fi até o spinner sumir
2. Se tiver vistorias pendentes de envio (badge no banner offline): conectar em Wi-Fi e aguardar
3. Nunca desinstalar o app com vistorias na fila

### O que NÃO fazer

- Não fechar o app no meio de uma vistoria (dados ficam na fila mas podem causar confusão)
- Não fazer a vistoria e tentar registrar só depois (GPS de chegada não será registrado)
- Não compartilhar login com outro agente

---

## 6. INDICADORES DO PILOTO

O sistema já produz todos os indicadores abaixo sem desenvolvimento adicional.

### Operacionais (diários)

| Indicador | Onde extrair |
|---|---|
| Focos criados no dia | Central Operacional + GestorFocos |
| Focos por status (fila, inspeção, confirmados, resolvidos) | KPI bar GestorFocos |
| Vistorias realizadas no dia | Central Operacional `vistorias_hoje` |
| Agentes em campo hoje | Central Operacional `agentes_ativos_hoje` |
| Focos P1 sem agente | Central Operacional `focos_p1_sem_agente` |
| SLAs vencidos | Central Operacional `slas_vencidos` |
| Denúncias de cidadão últimas 24h | Central Operacional |

### Gerenciais (semanais)

| Indicador | Onde extrair |
|---|---|
| Produtividade por agente (vistorias, focos inspecionados, tempo médio) | AdminProdutividadeAgentes |
| SLA cumprido % | AdminSla |
| Bairros mais críticos (score territorial) | AdminScoreConfig + v_score_bairro |
| Imóveis reincidentes (≥ 3 focos histórico) | Score territorial — fatores JSON |
| Focos por origem (drone, agente, cidadão) | GestorFocos — filtro origem |
| Mapa de calor por período | AdminHeatmapTemporal |
| Imóveis inacessíveis / prioridade drone | AdminImoveisProblematicos |

### Epidemiológicos (por ciclo)

| Indicador | Onde extrair |
|---|---|
| Índice de Infestação Predial (IIP) | AdminLiraa |
| Índice de Breteau (IBP) | AdminLiraa |
| Focos por tipo de depósito (A1–E) | AdminEficaciaTratamentos |
| Taxa de eliminação com/sem larvicida | AdminEficaciaTratamentos |
| Casos notificados × focos cruzados | AdminCasosNotificados |
| Score preditivo de surto por região | AdminScoreSurto |

---

## 7. RELATÓRIOS PARA APRESENTAÇÃO FINAL

### Relatório 1 — Resumo Operacional do Piloto
**Conteúdo:**
- Total de focos criados / inspecionados / resolvidos / descartados
- Tempo médio entre criação e inspeção
- Tempo médio entre inspeção e resolução
- Taxa de resolução no período
- Número de imóveis visitados vs. mapeados
- Imóveis inacessíveis identificados

**Fonte:** GestorFocos + AdminProdutividadeAgentes + exportação de dados

---

### Relatório 2 — Produtividade dos Agentes
**Conteúdo:**
- Vistorias por agente por semana
- Focos confirmados por agente
- Taxa de acesso por agente (% imóveis com entrada realizada)
- Uso do sistema: dias com vistorias registradas

**Fonte:** AdminProdutividadeAgentes (exportar / apresentar tela)

---

### Relatório 3 — SLA e Tempo de Resposta
**Conteúdo:**
- SLAs cumpridos vs. vencidos por prioridade
- Tempo médio até iniciar inspeção (por prioridade)
- Focos que escaparam do SLA — motivos

**Fonte:** AdminSla + dados do GestorFocos

---

### Relatório 4 — Mapa Territorial
**Conteúdo:**
- Heatmap de focos no período (antes e depois)
- Bairros com maior concentração
- Score médio por bairro (territorial risk)
- Quarteirões com IIP elevado

**Fonte:** AdminHeatmapTemporal + AdminLiraa + AdminMapaComparativo

---

### Relatório 5 — Impacto Epidemiológico (se notificador participou)
**Conteúdo:**
- Casos notificados no período
- Casos cruzados com focos (% cruzamento)
- Focos que tiveram prioridade elevada por proximidade de caso
- Distribuição de doenças notificadas

**Fonte:** AdminCasosNotificados

---

## 8. CRITÉRIOS DE SUCESSO DO PILOTO

### Critérios objetivos (mensuráveis)

| Critério | Meta | Como medir |
|---|---|---|
| Adesão dos agentes | ≥ 80% das vistorias no sistema (não em papel) | Total vistorias sistema / total real estimado |
| Uso diário do supervisor | ≥ 20 dos 30 dias operacionais com login | Logs Supabase |
| Rastreabilidade | 100% dos focos com histórico de transições | `foco_risco_historico` sem lacunas |
| Dados em tempo real | Foco confirmado em < 4h após vistoria finalizada | Timestamp `inspecao_em` vs `confirmado_em` |
| Relatório gerencial | Ao menos 1 relatório apresentado para gestão municipal | Ata de reunião |
| Zero perda de dados offline | Nenhum agente reportar vistoria "sumiu" | Suporte de campo |

### Critérios qualitativos (avaliados em reunião final)

- Supervisor declara: "consigo saber o que está acontecendo no campo sem ligar para ninguém"
- Agente declara: "é mais fácil do que usar papel"
- Coordenador de vigilância declara: "os dados do piloto têm qualidade suficiente para relatório SIESVS/SINAN"
- Gestão municipal declara: "queremos expandir para toda a cidade"

---

## 9. PAPÉIS E RESPONSABILIDADES

| Papel | Nome/Função | Responsabilidade no piloto |
|---|---|---|
| Gerente do piloto (Sentinella) | A definir | Setup, suporte, relatório final |
| Ponto focal na prefeitura | Coord. vigilância ambiental | Organizar equipe, liberar campo |
| Supervisor do piloto | Fiscal de endemias sênior | Operar telas de gestor, dar feedback |
| Agentes piloto | 3–5 agentes de controle de endemias | Usar app em campo, reportar bugs |
| Suporte técnico | Equipe Sentinella | Canal rápido, resposta em < 4h úteis |

---

## 10. PRÓXIMOS PASSOS APÓS O PILOTO

### Se bem-sucedido:

1. **Expansão territorial** — incluir demais bairros/zonas da cidade
2. **Seed de imóveis completo** — importar base completa de endereços
3. **Integração e-SUS Notifica** — testar em homologação com a UBS
4. **Ativar Canal Cidadão** — QR code impresso em materiais de campanha
5. **Score territorial em produção** — recálculo diário automático ativo
6. **Drone** — se a prefeitura tiver equipamento, integrar ao fluxo
7. **Contrato de operação** — SLA de suporte, plano de evolução, capacitação contínua

### Se parcialmente bem-sucedido (agentes aderiram, gestão não engajou):

1. Workshop de relatórios para gestão
2. Customizar Dashboard com indicadores prioritários da vigilância local
3. Treinar novo supervisor

### Se mal-sucedido (baixa adesão dos agentes):

1. Mapear bloqueios reais: celular inadequado, rede, resistência cultural
2. Simplificar fluxo de vistoria (reduzir etapas opcionais)
3. Considerar modo "entrada simplificada" para agentes menos digitais

---

## ANEXO A — CHECKLIST DE SETUP (SEMANA 0)

```
[ ] Prefeitura cadastrada no sistema
[ ] UF e código IBGE configurados
[ ] Bairros do piloto cadastrados (mínimo 3)
[ ] Regiões vinculadas aos bairros
[ ] Usuários criados e logins testados:
    [ ] Admin local
    [ ] Supervisor(es)
    [ ] Agente 1
    [ ] Agente 2
    [ ] Agente 3
    [ ] Notificador (se aplicável)
[ ] Imóveis importados (≥ 500 no perímetro do piloto)
[ ] Feriados locais configurados
[ ] SLA base configurado (usar padrão se não houver customização)
[ ] Planos de ação padrão cadastrados (tipos de tratamento)
[ ] Teste de foco completo:
    [ ] Criar foco manualmente
    [ ] Atribuir ao agente 1
    [ ] Agente inicia inspeção
    [ ] Agente finaliza vistoria
    [ ] Supervisor vê em "confirmado"
    [ ] Resolver foco
    [ ] Timeline completa visível
[ ] Teste offline:
    [ ] Agente faz vistoria sem rede
    [ ] Conecta Wi-Fi
    [ ] Dados sincronizados
[ ] Checklist assinado por coord. de vigilância + equipe Sentinella
```

---

## ANEXO B — PERGUNTAS FREQUENTES DOS AGENTES

**"Fiz a vistoria mas não aparece no sistema."**
→ Verificar o banner de sincronização. Se aparecer o número de vistorias pendentes, conectar em Wi-Fi e aguardar.

**"Errei uma informação na vistoria. Posso corrigir?"**
→ Comunicar ao supervisor para correção pelo gestor (sem correção direta pelo agente).

**"O app travou no meio da vistoria."**
→ Fechar e reabrir. Os dados da etapa atual podem ter sido perdidos, mas o rascunho é salvo a partir da etapa 1.

**"Não consigo ver meus focos atribuídos."**
→ Verificar internet. Se offline, os focos anteriores são visíveis. Se o dia for novo, o supervisor pode não ter atribuído ainda.

**"O imóvel não existe no sistema."**
→ Usar o cadastro rápido de imóvel na tela de lista. Informar bairro, logradouro e número.

---

*Documento gerado automaticamente pelo planejamento do piloto Sentinella — Abril 2026.*
