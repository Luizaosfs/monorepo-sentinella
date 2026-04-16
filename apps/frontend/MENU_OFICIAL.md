# MENU OFICIAL — SENTINELLA

## 1. Admin (Plataforma)

Menu do Admin deve ser separado do menu da prefeitura.

- Painel de Municípios
- Clientes / Prefeituras
- Usuários da Plataforma
- Quotas e Faturamento
- Saúde do Sistema
- Fila de Jobs
- Pipeline Drone
- Logs / Integrações

Admin NÃO deve ver o mesmo menu do supervisor.

---

## 2. Supervisor (Prefeitura)

Tela inicial: **Central do Dia**

Menu:

### Operação
- Central do Dia (HOME)
- Focos de Risco
- Mapa
- SLA

### Vigilância
- Casos Notificados
- Canal Cidadão
- Reincidência / Score

### Equipe
- Agentes
- Produtividade
- Cobertura

### Técnico
- Levantamentos
- Relatório LIRAa

### Gestão
- Painel Executivo
- Relatórios

### Sistema
- Configurações (grupo colapsável)

---

## 3. Agente

Tela inicial: **Meu Dia**

Menu:

- Meu Dia (HOME)
- Registrar Vistoria
- Minhas Vistorias
- Registrar Ocorrência Manual

Meu Dia deve conter:
- Lista de imóveis priorizados
- Mapa
- Pendências
- Barra de progresso
- Indicadores de sincronização

“Minha Rota” deve ser incorporado dentro do Meu Dia.

---

## 4. Notificador

Tela inicial: **Registrar Caso**

Menu:

- Registrar Caso
- Meus Casos
- Consultar Protocolo

Interface deve ser simples e direta.

---

## 5. Regras de Navegação

- Cada perfil vê apenas o que precisa
- Central do Dia = cérebro do supervisor
- Meu Dia = cérebro do agente
- Configurações devem ficar agrupadas e raramente acessadas
- Triagem deve estar dentro do fluxo de Focos, não como mundo separado