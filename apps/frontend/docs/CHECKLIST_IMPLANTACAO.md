# Checklist de Implantação — Sistema Sentinella
### Prefeitura: _______________________________
### Responsável Sentinella: _______________________________
### Data de início: _____ / _____ / _________
### Previsão de operação plena: _____ / _____ / _________

---

## FASE 1 — Preparação
> Prazo estimado: 1 a 2 semanas antes do treinamento

### 1.1 Cadastro da Prefeitura no Sistema

- [ ] Criar o cliente no painel Sentinella (nome do município, UF, código IBGE)
- [ ] Confirmar e-mail institucional do gestor responsável
- [ ] Configurar o logotipo e nome do município no sistema
- [ ] Validar o domínio de e-mail para envio de relatórios automáticos
- [ ] Confirmar o endereço de e-mail do suporte local (`suporte@sentinella.app` monitorado)
- [ ] Definir o período de piloto e calendário de treinamentos

### 1.2 Cadastro de Usuários

- [ ] Levantar lista de agentes com nome e e-mail institucional
- [ ] Levantar lista de supervisores com nome e e-mail
- [ ] Levantar lista de notificadores das unidades de saúde com e-mail
- [ ] Cadastrar todos os usuários no sistema antes do treinamento
- [ ] Enviar credenciais provisórias para cada usuário
- [ ] Confirmar que todos conseguiram fazer login antes do treinamento
- [ ] Definir qual supervisor será o administrador principal
- [ ] Verificar se nenhum usuário está com papel errado (operador, notificador, supervisor)

### 1.3 Importação de Imóveis

- [ ] Solicitar à prefeitura a base de imóveis (planilha ou exportação do sistema existente)
- [ ] Verificar se a planilha está no formato correto (colunas: logradouro, numero, bairro, cidade, uf)
- [ ] Limpar dados: remover duplicados, corrigir bairros com nomes diferentes para o mesmo lugar
- [ ] Verificar se há coordenadas (lat/lng) — se não houver, o sistema vai geocodificar (até 300 por vez)
- [ ] Fazer importação de teste com 10–20 linhas para validar o mapeamento de colunas
- [ ] Executar importação completa
- [ ] Conferir relatório de importação: importados, duplicados, erros
- [ ] Confirmar total de imóveis importados com o gestor da prefeitura
- [ ] Imóveis sem coordenadas geocodificadas: verificar se estão com endereço correto no mapa

### 1.4 Configuração de Bairros e Regiões

- [ ] Levantar lista oficial de bairros do município
- [ ] Cadastrar as regiões no sistema (Norte, Sul, Centro, etc.) se aplicável
- [ ] Vincular os bairros às regiões correspondentes
- [ ] Confirmar com o gestor se a divisão está de acordo com a operação da prefeitura
- [ ] Definir quais bairros/regiões fazem parte do piloto (Fase 3)

### 1.5 Configuração de SLA

- [ ] Definir com o gestor os prazos de atendimento por prioridade:
  - [ ] Crítico / Urgente: padrão 4h — ajustar se necessário: _______ h
  - [ ] Alta: padrão 12h — ajustar se necessário: _______ h
  - [ ] Moderada: padrão 24h — ajustar se necessário: _______ h
  - [ ] Baixa: padrão 72h — ajustar se necessário: _______ h
- [ ] Cadastrar os feriados municipais do ano corrente
- [ ] Cadastrar os feriados estaduais e nacionais do ano corrente
- [ ] Validar com o gestor se o SLA será suspenso em feriados
- [ ] Confirmar funcionamento do alerta automático de SLA próximo do vencimento

### 1.6 Configuração de Equipes e Roteiros

- [ ] Definir a divisão de quarteirões por agente
- [ ] Registrar a distribuição de quarteirões no sistema (Menu: Distribuição de Quarteirão)
- [ ] Confirmar com cada agente quais são os imóveis do seu roteiro
- [ ] Configurar o ciclo operacional vigente (ciclo 1 a 6)

### 1.7 Canal do Cidadão

- [ ] Gerar o QR Code e link do canal do cidadão (Menu: Canal Cidadão)
- [ ] Enviar link para o setor de comunicação da prefeitura
- [ ] Definir onde o QR Code será divulgado (redes sociais, panfletos, sede)
- [ ] Confirmar que o supervisor responsável receberá as notificações de denúncias

### 1.8 Integração com Unidades de Saúde (se aplicável)

- [ ] Levantar lista de UBS, UPAs e hospitais do município
- [ ] Cadastrar as unidades no sistema (Menu: Unidades de Saúde)
- [ ] Configurar código IBGE e UF do município para sincronização CNES
- [ ] Executar sincronização CNES manual e validar resultado
- [ ] Confirmar integração com e-SUS Notifica (se disponível): chave de API, ambiente, CNES

**Checklist Fase 1 concluída?**
- [ ] Todos os itens acima verificados
- [ ] Gestor da prefeitura validou os dados importados
- [ ] Todos os usuários conseguem fazer login
- [ ] Data de início do treinamento confirmada: _____ / _____ / _________

---

## FASE 2 — Treinamento
> Prazo estimado: 1 dia presencial (ou 2 dias por videoconferência)

### 2.1 Treinamento de Supervisores e Gestores
> Duração recomendada: 3 a 4 horas

- [ ] Apresentar a visão geral do sistema (Central Operacional, Mapa, KPIs)
- [ ] Demonstrar o mapa de focos: filtros, heatmap, comparativo entre períodos
- [ ] Ensinar como acompanhar produtividade dos agentes (Menu: Produtividade)
- [ ] Ensinar como monitorar SLA: alertas, escalada, feriados
- [ ] Ensinar como gerar Relatório PDF (Central Operacional → Relatório PDF)
- [ ] Mostrar o Canal do Cidadão: como funciona, como acompanhar denúncias
- [ ] Ensinar como cadastrar novos usuários
- [ ] Ensinar como importar imóveis (demonstração com planilha de exemplo)
- [ ] Mostrar como acompanhar casos notificados de dengue (integração com saúde)
- [ ] Explicar o score de risco por imóvel e como usar na priorização
- [ ] Entregar: Manual do Supervisor impresso
- [ ] Aplicar avaliação prática: o supervisor demonstra as principais funções
- [ ] Tirar dúvidas e registrar pontos de atenção: _______________________________

### 2.2 Treinamento de Agentes de Campo
> Duração recomendada: 2 a 3 horas

- [ ] Apresentar o sistema no celular (login, tela inicial)
- [ ] Demonstrar a tela "Meu Dia": como ver o roteiro, prioridades e cores
- [ ] Ensinar como selecionar o tipo de atividade do dia
- [ ] Demonstrar o passo a passo da vistoria (7 etapas)
- [ ] Praticar: cada agente registra uma vistoria de teste em tempo real
- [ ] Demonstrar o modo offline: desligar o wi-fi e registrar uma vistoria
- [ ] Demonstrar a sincronização: ligar o wi-fi e confirmar envio
- [ ] Ensinar como registrar imóvel fechado (motivo, horário de retorno)
- [ ] Explicar o que acontece na 3a tentativa sem acesso (drone)
- [ ] Ensinar como reportar sintomas em moradores (alerta de caso suspeito)
- [ ] Tirar dúvidas e simular problemas frequentes (GPS, sem sinal, tela travada)
- [ ] Entregar: Manual do Agente impresso
- [ ] Confirmar que todos os agentes conseguem registrar uma vistoria sem ajuda
- [ ] Registrar agentes com dificuldade que precisam de acompanhamento: _____________

### 2.3 Treinamento de Notificadores (Saúde)
> Duração recomendada: 1 a 2 horas

- [ ] Apresentar o módulo de notificação de casos (Menu: Registrar Caso)
- [ ] Demonstrar como registrar um caso suspeito de dengue
- [ ] Ensinar como localizar o endereço no mapa (dicas para endereços difíceis)
- [ ] Explicar as regras de LGPD: não registrar nome, CPF ou dados pessoais
- [ ] Demonstrar como atualizar a situação de um caso (suspeito → confirmado)
- [ ] Explicar o que acontece quando um caso é cruzado com um foco próximo
- [ ] Demonstrar como acompanhar casos registrados
- [ ] Explicar a integração com e-SUS Notifica, se habilitada
- [ ] Entregar: Manual do Notificador impresso
- [ ] Confirmar que cada notificador consegue registrar um caso de teste

**Checklist Fase 2 concluída?**
- [ ] Todos os perfis treinados
- [ ] Manuais entregues
- [ ] Agentes conseguem registrar vistoria sem auxílio
- [ ] Supervisor consegue acompanhar operação sem auxílio
- [ ] Data de início do piloto confirmada: _____ / _____ / _________

---

## FASE 3 — Piloto
> Prazo estimado: 2 a 4 semanas
> Bairro do piloto definido: _______________________________

### 3.1 Definição do Piloto

- [ ] Escolher 1 bairro ou região representativa (nem o mais simples nem o mais complexo)
- [ ] Confirmar número de imóveis na área do piloto: _________
- [ ] Confirmar número de agentes no piloto: _________
- [ ] Definir o supervisor responsável pelo acompanhamento do piloto
- [ ] Comunicar formalmente os agentes que farão parte do piloto

### 3.2 Execução do Primeiro Ciclo

- [ ] Dia 1: acompanhar presencialmente os agentes nas primeiras visitas
- [ ] Verificar se o GPS está sendo registrado corretamente em campo
- [ ] Verificar se as vistorias estão chegando ao sistema em tempo real (ou offline + sync)
- [ ] Verificar se o mapa de focos está sendo atualizado conforme as vistorias
- [ ] Verificar se o SLA está sendo calculado corretamente para os focos encontrados
- [ ] Verificar se o supervisor está recebendo os alertas de SLA
- [ ] Registrar os primeiros focos encontrados e acompanhar o fluxo completo até a resolução
- [ ] Verificar se os casos notificados estão sendo cruzados com focos próximos

### 3.3 Ajustes Durante o Piloto

- [ ] Reunião de ponto com o supervisor ao final da 1a semana
- [ ] Listar problemas encontrados pelos agentes:
  - _________________________________________________________
  - _________________________________________________________
  - _________________________________________________________
- [ ] Listar ajustes necessários no sistema (bairros, SLA, roteiros):
  - _________________________________________________________
  - _________________________________________________________
- [ ] Aplicar correções e confirmar com o supervisor que estão resolvidos
- [ ] Verificar se há imóveis com endereço errado ou sem localização no mapa
- [ ] Corrigir imóveis com problema de geocodificação

### 3.4 Avaliação do Piloto

- [ ] Quantos imóveis foram visitados no ciclo do piloto: _________
- [ ] Quantos focos foram encontrados: _________
- [ ] Quantos focos foram tratados dentro do SLA: _________
- [ ] Taxa de SLA no prazo: _________ %
- [ ] Agentes que tiveram mais dificuldade: _________________________
- [ ] Pontos de melhoria identificados: _____________________________
- [ ] Aprovação do gestor para expansão: [ ] Sim  [ ] Aguardando ajuste

**Checklist Fase 3 concluída?**
- [ ] Piloto executado por pelo menos 1 ciclo completo
- [ ] Principais problemas corrigidos
- [ ] Gestor aprovou a expansão para o município inteiro
- [ ] Data de início da operação plena: _____ / _____ / _________

---

## FASE 4 — Operação Plena
> A partir da 5a semana

### 4.1 Expansão para o Município

- [ ] Habilitar todos os agentes e bairros no sistema
- [ ] Comunicar formalmente todos os agentes sobre início da operação
- [ ] Confirmar que todos os agentes conseguem fazer login e acessar seu roteiro
- [ ] Confirmar que o Canal do Cidadão está divulgado em canais oficiais da prefeitura
- [ ] Confirmar que as unidades de saúde estão registrando casos no sistema
- [ ] Configurar o relatório semanal automático (confirmar e-mail do destinatário)

### 4.2 Acompanhamento de SLA

- [ ] Verificar diariamente a Central Operacional: focos críticos sem agente
- [ ] Verificar semanalmente o painel de SLA: taxa de cumprimento
- [ ] Agir quando a taxa de SLA cair abaixo de 80%:
  - [ ] Identificar os focos atrasados
  - [ ] Redistribuir para agentes disponíveis
  - [ ] Registrar o motivo do atraso
- [ ] Verificar se os feriados do mês estão cadastrados corretamente
- [ ] Escalar para administração superior focos com SLA vencido há mais de 2x o prazo

### 4.3 Acompanhamento de Produtividade

- [ ] Verificar semanalmente o ranking de vistorias por agente (Menu: Produtividade)
- [ ] Identificar agentes com produção abaixo da média
- [ ] Identificar bairros com menor cobertura
- [ ] Verificar imóveis com 3+ tentativas sem acesso (Menu: Imóveis Problemáticos)
- [ ] Acionar voo de drone para imóveis inacessíveis com calha visível, se disponível
- [ ] Emitir notificação formal para imóveis com reincidência de recusa

### 4.4 Acompanhamento de Focos e Denúncias

- [ ] Verificar diariamente o mapa de focos: novos focos não atribuídos
- [ ] Verificar denúncias do canal cidadão: todas devem ser atribuídas em até 24h
- [ ] Verificar casos notificados de dengue x focos próximos
- [ ] Acionar planejamento de campo quando houver cluster de 3+ casos no mesmo bairro

### 4.5 Geração de Relatórios

- [ ] Confirmar que o relatório semanal automático está chegando por e-mail
- [ ] Gerar Relatório PDF toda sexta-feira para envio à secretaria
- [ ] Calcular o índice LIRAa ao final de cada ciclo (Menu: LIRAa)
- [ ] Verificar eficácia dos tratamentos de larvicida por tipo de depósito

**Checklist Fase 4 concluída?**
- [ ] Todos os bairros em operação
- [ ] SLA monitorado semanalmente
- [ ] Relatórios sendo gerados e enviados
- [ ] Gestor operando o sistema de forma autônoma

---

## FASE 5 — Rotina Mensal
> Repetir todo mês durante toda a operação

### 5.1 Fechamento do Mês Anterior

- [ ] Gerar relatório mensal consolidado (PDF + CSV)
- [ ] Registrar indicadores do mês:
  - Total de vistorias realizadas: _________
  - Total de focos encontrados: _________
  - Total de focos tratados: _________
  - Taxa de SLA cumprido: _________ %
  - Total de denúncias de cidadãos: _________
  - Total de casos notificados de dengue: _________
  - Índice LIRAa do ciclo: _________ %
- [ ] Verificar imóveis com maior reincidência de focos
- [ ] Identificar bairros com maior índice de infestação
- [ ] Comparar com o mês anterior: está melhorando ou piorando?

### 5.2 Reunião Mensal com o Gestor

- [ ] Agendar reunião com o secretário de saúde ou coordenador de endemias
- [ ] Apresentar os indicadores do mês
- [ ] Apresentar os 10 imóveis mais críticos (score de risco)
- [ ] Apresentar o ranking de agentes
- [ ] Discutir ações para o mês seguinte:
  - Bairros prioritários: _______________________________
  - Agentes que precisam de suporte: _______________________________
  - Ajustes necessários no sistema: _______________________________
- [ ] Registrar ata da reunião e encaminhar para os participantes

### 5.3 Ajustes para o Próximo Mês

- [ ] Atualizar base de imóveis (novos cadastros, demolições, mudanças de endereço)
- [ ] Atualizar cadastro de usuários (novos agentes, saídas, mudanças de papel)
- [ ] Cadastrar feriados do próximo mês
- [ ] Ajustar distribuição de quarteirões por agente, se necessário
- [ ] Atualizar o ciclo operacional (1 a 6)
- [ ] Revisar configuração de SLA se houve mudança nos prazos definidos pela prefeitura
- [ ] Verificar se há novas unidades de saúde para cadastrar

### 5.4 Comunicação

- [ ] Enviar resumo mensal para a equipe de agentes
- [ ] Divulgar indicadores positivos nos canais internos da prefeitura
- [ ] Atualizar o QR Code do Canal do Cidadão, se necessário (link não muda)
- [ ] Verificar se há novos agentes que precisam de treinamento

---

## Contatos de Suporte

| Responsável | Contato | Função |
|------------|---------|--------|
| Suporte Sentinella | suporte@sentinella.app | Problemas técnicos, dúvidas, erros |
| Supervisor Municipal | ___________________________ | Ponto focal da prefeitura |
| Responsável TI (se houver) | ___________________________ | Acesso à rede, dispositivos |

---

## Registro de Ocorrências

| Data | Ocorrência | Ação tomada | Resolvido? |
|------|-----------|-------------|-----------|
| | | | |
| | | | |
| | | | |
| | | | |

---

*Checklist de Implantação  |  Sistema Sentinella  |  Versao 1.0*
*Este documento deve ser preenchido e arquivado como registro da implantacao.*
