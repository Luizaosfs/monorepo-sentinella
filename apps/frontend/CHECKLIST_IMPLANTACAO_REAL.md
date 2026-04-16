# CHECKLIST DE IMPLANTAÇÃO REAL — SENTINELLA
**Objetivo:** Guia operacional para implantar o Sentinella em uma prefeitura real.
**Tempo estimado:** 1–2 dias (com suporte técnico presente)

---

## PRÉ-IMPLANTAÇÃO (antes do dia 1)

### Coleta de informações da prefeitura
- [ ] Nome oficial da prefeitura
- [ ] UF (2 letras)
- [ ] Código IBGE do município (7 dígitos) — consultar ibge.gov.br
- [ ] Número aproximado de imóveis a vistoriar
- [ ] Número de agentes de campo disponíveis
- [ ] Contato do supervisor municipal (e-mail + telefone)
- [ ] Contato do responsável de TI (se houver)
- [ ] Feriados municipais do ano vigente

### Base de imóveis
- [ ] Solicitar planilha de imóveis (logradouro, número, bairro, quarteirão, CEP)
- [ ] Verificar se há coordenadas GPS ou se precisará de geocodificação
- [ ] Limpar duplicatas e endereços sem número
- [ ] Converter para CSV com colunas: `logradouro, numero, complemento, bairro, quarteirao, latitude, longitude, tipo_imovel`
- [ ] Revisar amostra de 50 imóveis antes de importar tudo

### Dispositivos dos agentes
- [ ] Confirmar modelo e versão do Android/iOS de cada agente
- [ ] Testar acesso ao sistema via navegador (Chrome/Firefox)
- [ ] Confirmar que GPS funciona nos dispositivos de campo
- [ ] Testar captura de foto nos dispositivos

---

## DIA 1 — CONFIGURAÇÃO DA PLATAFORMA

**Quem executa:** Admin da plataforma (suporte Sentinella)

### Criar cliente
- [ ] Acessar `/admin/clientes` → Novo cliente
- [ ] Preencher: nome, UF, IBGE (7 dígitos)
- [ ] Salvar e confirmar seed automático criado (quotas, SLA, score, feriados)
- [ ] Anotar o `cliente_id` gerado

### Configurar regiões e bairros
- [ ] Acessar `/admin/regioes`
- [ ] Cadastrar todas as regiões/bairros da área de operação
- [ ] Vincular cada bairro à região correspondente

### Configurar quarteirões
- [ ] Acessar `/admin/distribuicao-quarteirao`
- [ ] Cadastrar quarteirões por região
- [ ] Distribuir quarteirões entre agentes (um agente por quarteirão ou mais, conforme equipe)

### Abrir ciclo
- [ ] Acessar `/admin/ciclos` → Abrir ciclo
- [ ] Definir número do ciclo e meta de cobertura (%)

### Importar imóveis
- [ ] Acessar `/admin/importar-imoveis`
- [ ] Upload do CSV preparado
- [ ] Verificar contagem importada e erros reportados
- [ ] Corrigir imóveis com coordenadas inválidas (usar geocodificação manual se necessário)
- [ ] Confirmar amostra em `/admin/imoveis`

### Sincronizar CNES
- [ ] Acessar `/admin/unidades-saude`
- [ ] Clicar "Sincronizar agora"
- [ ] Aguardar conclusão (1–2 min)
- [ ] Confirmar que UBSs e hospitais do município aparecem na lista
- [ ] Adicionar manualmente unidades que não constam no CNES (postos comunitários, etc.)

### Feriados municipais
- [ ] Acessar `/admin/sla-feriados`
- [ ] Adicionar feriados municipais específicos do ano vigente

---

## DIA 1 — CRIAÇÃO DE USUÁRIOS

**Quem executa:** Admin da plataforma + supervisor municipal

### Supervisor municipal
- [ ] Acessar `/admin/usuarios` → Novo usuário
- [ ] Preencher e-mail do supervisor, papel: `supervisor`
- [ ] Enviar link de primeiro acesso
- [ ] Supervisor confirma recebimento e acesso
- [ ] Supervisor conclui OnboardingModal (tour de boas-vindas)

### Agentes de campo
- [ ] Criar conta para cada agente (e-mail + papel: `operador`)
- [ ] Enviar credenciais para cada agente
- [ ] Cada agente faz login no próprio dispositivo e conclui onboarding
- [ ] Testar GPS no dispositivo de cada agente após login

### Notificadores (unidades de saúde)
- [ ] Criar conta para cada notificador (e-mail + papel: `notificador`)
- [ ] Vincular cada notificador à unidade de saúde correta
- [ ] Notificador faz login e conclui onboarding

---

## DIA 2 — TREINAMENTO

### Treinamento do supervisor (2–3 horas)
- [ ] Tour pela Central do Dia (`/gestor/central`)
- [ ] Como acompanhar focos em `/gestor/focos`
- [ ] Como usar o mapa de focos (`/gestor/mapa`)
- [ ] Como interpretar o score territorial e LIRAa
- [ ] Como monitorar SLA e agir nos casos críticos
- [ ] Como ver produtividade dos agentes
- [ ] Como criar planejamentos em `/admin/planejamentos`
- [ ] Como usar o supervisor em tempo real (`/admin/supervisor-tempo-real`)
- [ ] Como receber e interpretar o relatório semanal por e-mail
- [ ] Habilitar notificações push no navegador

### Treinamento dos agentes (1–2 horas cada)
- [ ] Demonstrar Meu Dia (`/agente/hoje`)
- [ ] Demonstrar lista de imóveis e busca
- [ ] Executar vistoria completa (5 etapas) em imóvel de teste
- [ ] Demonstrar fluxo "sem acesso" (motivo, calha, horário de retorno)
- [ ] Testar modo offline: desligar Wi-Fi → fazer vistoria → religar → sincronizar
- [ ] Tirar foto de evidência e confirmar upload
- [ ] Cada agente faz 1 vistoria real supervisionada

### Treinamento dos notificadores (1 hora)
- [ ] Demonstrar registro de caso em `/notificador/registrar`
- [ ] Explicar campos obrigatórios e restrições LGPD
- [ ] Demonstrar busca de endereço com geocodificação
- [ ] Mostrar lista de casos e como confirmar/descartar
- [ ] Explicar cruzamento automático com focos próximos

---

## DIA 2 (tarde) — TESTE OPERACIONAL SUPERVISIONADO

- [ ] Supervisor cria planejamento de vistoria manual
- [ ] 1 agente executa vistoria real em 3 imóveis
- [ ] Supervisor confirma vistorias na Central do Dia em tempo real
- [ ] Notificador registra 1 caso de teste
- [ ] Supervisor verifica cruzamento foco ↔ caso
- [ ] Testar denúncia cidadão via QR gerado em `/admin/canal-cidadao`
- [ ] Supervisor recebe push de notificação da denúncia

---

## PÓS-IMPLANTAÇÃO (semanas 1–4)

### Semana 1 — Operação assistida diária
- [ ] Suporte disponível via WhatsApp durante horário de campo
- [ ] Revisar logs de erros diariamente (`/admin/saude-sistema`)
- [ ] Ajustar score territorial se necessário (`/admin/score-config`)
- [ ] Corrigir imóveis com coordenadas erradas reportados pelos agentes
- [ ] Verificar sincronização offline de todos os agentes

### Semana 2–4 — Reduzindo assistência
- [ ] Supervisor passa a operar de forma autônoma
- [ ] Suporte apenas para dúvidas e incidentes
- [ ] Primeiro relatório semanal automático recebido (verificar)
- [ ] Primeiro snapshot de billing gerado (verificar `/admin/quotas`)
- [ ] Coletar feedback estruturado de cada perfil (formulário ou reunião)

---

## CRITÉRIOS DE SUCESSO DO PILOTO

| Métrica | Meta mínima | Resultado |
|---|---|---|
| Agentes operando de forma autônoma | 100% | |
| Vistorias realizadas sem suporte técnico | > 80% | |
| Taxa de sincronização offline | > 95% | |
| SLA médio de atendimento de foco | Dentro do configurado | |
| Supervisor usando Central do Dia diariamente | Sim | |
| Relatório semanal recebido e lido | Sim | |
| Zero vazamento de dados cross-tenant | Confirmado | |

**Data de início:** ___________
**Prefeitura:** ___________
**Responsável Sentinella:** ___________
**Responsável prefeitura:** ___________
