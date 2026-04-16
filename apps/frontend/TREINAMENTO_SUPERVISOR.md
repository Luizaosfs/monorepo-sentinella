# GUIA DE TREINAMENTO — SUPERVISOR MUNICIPAL
**Sistema:** Sentinella
**Perfil:** Supervisor / Gestor Municipal
**Duração:** 4 horas (presencial ou remoto via vídeo)
**Pré-requisito:** Usuário criado e primeiro acesso concluído

---

## OBJETIVO DO TREINAMENTO

Ao fim deste treinamento, o supervisor deve ser capaz de:
- Ler e interpretar a Central do Dia de forma autônoma
- Acompanhar o trabalho dos agentes em tempo real
- Gerenciar focos de risco (transições de estado, SLA)
- Interpretar o LIRAa e o score territorial
- Receber e agir sobre alertas (push, e-mail, dashboard)
- Coordenar denúncias de cidadãos

---

## MÓDULO 1 — ACESSO E ORIENTAÇÃO (15 min)

### 1.1 Login e perfil
1. Acessar o sistema no navegador (Chrome ou Firefox recomendado)
2. Inserir e-mail e senha recebidos por e-mail
3. Clicar em "Entrar"
4. Concluir o OnboardingModal de boas-vindas (tour inicial)

**Ponto importante:** O supervisor vê **apenas** dados do próprio município. Nenhum dado de outras prefeituras aparece.

### 1.2 Navegação
O menu lateral contém:
| Item | Para que serve |
|---|---|
| Central do Dia | Painel principal com KPIs diários |
| Focos de Risco | Lista e gestão de todos os focos |
| Mapa | Visualização geográfica de focos |
| SLA | Monitoramento de prazos |
| LIRAa | Índice de infestação por quarteirão |
| Score | Análise territorial de risco |
| Relatórios | PDFs e histórico |

**Prática:** Navegar por cada item do menu e retornar à Central do Dia.

---

## MÓDULO 2 — CENTRAL DO DIA (45 min)

Rota: `/gestor/central`

### 2.1 KPIs principais
O painel exibe 4 indicadores atualizados a cada 60 segundos:

| KPI | O que significa |
|---|---|
| Focos Ativos | Total de focos abertos (suspeito + confirmado + em tratamento) |
| SLA em Risco | Focos com prazo ≤ 2 horas para vencer |
| Vistorias Hoje | Vistorias realizadas no dia corrente |
| Agentes em Campo | Agentes que já fizeram checkin hoje |

**Prática:** Identificar o KPI mais preocupante do dia e clicar nele para ver a lista detalhada.

### 2.2 Alertas urgentes
O painel exibe alertas automáticos quando:
- Há focos com SLA vencendo em < 2 horas
- Mais de 3 denúncias de cidadãos foram recebidas no dia
- Casos notificados foram registrados hoje

**Ação esperada:** Clicar no alerta → ver detalhes → tomar ação.

### 2.3 Top imóveis críticos
Lista dos imóveis com maior score territorial de risco. Cada imóvel exibe:
- Endereço
- Score (0–100, com badge colorido)
- Status do último foco

**Prática:** Abrir o detalhe de um imóvel crítico e verificar o histórico de focos.

### 2.4 Agentes em campo hoje
Widget mostrando quais agentes fizeram checkin, quantas vistorias realizaram e quando foi a última atividade.

---

## MÓDULO 3 — FOCOS DE RISCO (60 min)

Rota: `/gestor/focos`

### 3.1 Leitura da lista
Cada linha representa um foco de risco. Colunas principais:
- **Status:** suspeita → em triagem → confirmado → em tratamento → resolvido / descartado
- **Prioridade:** P1 (Crítico), P2 (Alto), P3 (Médio)
- **SLA:** tempo restante para resolução
- **Origem:** drone, vistoria manual, denúncia cidadão, sistema

### 3.2 Filtros
O supervisor pode filtrar por:
- Status (múltiplos)
- Prioridade
- Origem
- Bairro / Quarteirão
- Período

**Dica:** Filtrar por "SLA vencendo" + "Crítico" toda manhã é a rotina recomendada.

### 3.3 Transições de estado
Para avançar um foco:
1. Clicar no foco → abrir detalhe
2. Clicar no botão de ação (ex.: "Confirmar", "Iniciar Tratamento", "Resolver")
3. Preencher observação (opcional mas recomendado)
4. Confirmar

**Fluxo completo:**
```
Suspeita → Em Triagem → Confirmado → Em Tratamento → Resolvido
                                   ↘ Descartado
```

**Regra importante:** `Resolvido` e `Descartado` são estados finais. Para reabertura, um novo foco é criado com referência ao anterior.

### 3.4 Casos próximos
Quando um foco tem casos notificados em um raio de 300m, um banner vermelho aparece no detalhe com:
- Doença (dengue, chikungunya, zika, suspeito)
- Data do caso
- Distância aproximada

**Ação esperada:** Elevar prioridade do foco para P1 se ainda não estiver.

### 3.5 Observações
O supervisor pode adicionar observações a qualquer foco para registrar contexto, decisões ou instruções para a equipe.

**Prática:** Criar um foco de teste → transicionar por todos os estados → adicionar observação em cada um.

---

## MÓDULO 4 — MAPA E HEATMAP (30 min)

Rota: `/gestor/mapa`

### 4.1 Mapa de focos
- Pins coloridos por prioridade (vermelho=P1, laranja=P2, amarelo=P3)
- Clicar em um pin abre o resumo do foco
- Filtros na barra lateral: status, prioridade, classificação de score

### 4.2 Heatmap temporal
- Slider de semanas permite ver a evolução da infestação ao longo do tempo
- Play/Pause para animação automática
- Útil para identificar bairros com piora progressiva

### 4.3 Mapa antes/depois
Rota: `/admin/mapa-comparativo`
- Selecionar dois levantamentos de drone
- Comparar lado a lado (toggle A | B | Dividido)
- Evidencia melhora ou piora na operação

**Prática:** Identificar no mapa o bairro com maior concentração de focos P1.

---

## MÓDULO 5 — SLA (30 min)

Rota: `/admin/sla`

### 5.1 O que é SLA
SLA (Service Level Agreement) é o prazo máximo para resolução de um foco, calculado automaticamente com base na prioridade:

| Prioridade | SLA base | Fatores de redução |
|---|---|---|
| Crítico (P1) | 4 horas | Risco Muito Alto (-30%), persistência > 3 dias (-20%) |
| Alto (P2) | 12 horas | Temperatura > 30°C (-10%) |
| Médio (P3) | 24 horas | — |
| Baixo | 72 horas | — |

**Mínimo absoluto:** 2 horas (mesmo com todas as reduções).

### 5.2 Alertas de SLA
- Push no navegador quando SLA ≤ 1 hora
- Badge vermelho no item de menu "SLA"
- Card de alerta na Central do Dia

**Ação esperada:** Ver focos em SLA crítico → acionar agente responsável via WhatsApp → registrar tratamento.

### 5.3 Auditoria de SLA
Cada foco tem uma timeline: criado → atendimento iniciado → resolvido.
Útil para relatórios e prestação de contas.

---

## MÓDULO 6 — LIRAa E SCORE TERRITORIAL (30 min)

### 6.1 LIRAa
Rota: `/admin/liraa`

O LIRAa (Levantamento de Índice Rápido para Aedes aegypti) é o indicador oficial de infestação:

| Classificação | IIP | Cor |
|---|---|---|
| Satisfatório | < 1% | Verde |
| Alerta | 1% – 3,9% | Âmbar |
| Risco | ≥ 4% | Vermelho |

**Como usar:**
1. Selecionar o ciclo atual
2. Ver IIP municipal (topo)
3. Analisar tabela por quarteirão
4. Quarteirões em vermelho = prioridade para intensificação

**Exportar:** Botão "Exportar PDF" gera boletim LIRAa para envio à Secretaria.

### 6.2 Score Territorial
Rota: `/admin/score-config` (configuração) | Central do Dia (visualização)

O score é calculado automaticamente para cada imóvel (0–100) com base em:
- Histórico de focos
- Recorrência
- Casos notificados próximos
- Depósitos de risco

| Score | Classificação | Badge |
|---|---|---|
| 80–100 | Crítico | Vermelho |
| 60–79 | Alto | Laranja |
| 40–59 | Moderado | Âmbar |
| 20–39 | Baixo | Azul |
| 0–19 | Mínimo | Verde |

**Prática:** Ver os 10 imóveis com maior score e verificar se têm focos ativos.

---

## MÓDULO 7 — NOTIFICAÇÕES E ALERTAS (15 min)

### 7.1 Push no navegador
1. Clicar em "Ativar notificações" no banner que aparece ao logar
2. Confirmar no diálogo do navegador
3. Testar: receber push de denúncia cidadão (simular via QR)

### 7.2 Relatório semanal por e-mail
- Enviado automaticamente toda segunda-feira às 8h
- Contém: vistorias da semana, focos abertos/resolvidos, SLA médio, LIRAa atual, alertas
- Encaminhar à Secretaria de Saúde conforme necessário

### 7.3 Denúncias de cidadãos
Rota: `/admin/canal-cidadao`
1. Ver lista de denúncias recebidas
2. Cada denúncia gera automaticamente um foco de origem "cidadão"
3. Foco aparece na lista com badge roxo "Cidadão"
4. Supervisor recebe push imediato ao receber denúncia

---

## MÓDULO 8 — PLANEJAMENTOS (15 min)

Rota: `/admin/planejamentos`

### Como criar um planejamento
1. Clicar em "Novo Planejamento"
2. Selecionar região/bairro
3. Selecionar tipo: Manual ou Drone
4. Definir período
5. Salvar

**Dica:** Criar planejamento semanal toda segunda-feira com base nos focos abertos e score territorial.

---

## AVALIAÇÃO DO TREINAMENTO

O supervisor demonstrou capacidade autônoma de:

| Habilidade | Demonstrado? |
|---|---|
| Ler a Central do Dia e identificar alertas | [ ] Sim [ ] Não |
| Transicionar um foco por todos os estados | [ ] Sim [ ] Não |
| Usar filtros na lista de focos | [ ] Sim [ ] Não |
| Interpretar o LIRAa e identificar quarteirões em risco | [ ] Sim [ ] Não |
| Ativar notificações push | [ ] Sim [ ] Não |
| Criar um planejamento de vistoria | [ ] Sim [ ] Não |
| Gerar PDF do LIRAa | [ ] Sim [ ] Não |

**Data do treinamento:** ___________
**Instrutor:** ___________
**Supervisor treinado:** ___________
**Resultado:** [ ] Aprovado [ ] Requer reforço
