# SENTINELLA — PLANO FINAL PARA IMPLANTAÇÃO EM PREFEITURA

> Versão: 1.0 — Data: 2026-04-02
> Baseado em: VERDADE_FUNCIONAL.md, AUDITORIA_RLS.md, PADRONIZACAO_FRONTEND.md, REVISAO_UI_UX.md

---

## 1. O QUE PRECISA SER CORRIGIDO ANTES DO PILOTO

### 1.1 Segurança e Banco de Dados

| ID | Criticidade | Problema | Correção |
|----|-------------|----------|----------|
| S1 | CRÍTICO | `get_meu_papel()` não reconhece papel `notificador` no CASE — retorna 0 (prioridade mínima) | Adicionar `WHEN 'notificador' THEN 3` na função SQL |
| S2 | CRÍTICO | Tabela `drones`: policy `SELECT USING(true)` expõe todos os drones de todos os clientes | Trocar para `USING(usuario_pode_acessar_cliente(cliente_id))` |
| S3 | ALTO | Tabelas legadas (`clientes`, `levantamentos`, `levantamento_itens`, `regioes`, `usuarios`) têm policies duplicadas: old-style `tem_papel()` + new-style `is_admin()` | Remover policies old-style via migration CLEANUP-04 |
| S4 | ALTO | `sla_operacional`: itens com `cliente_id IS NULL` não são acessíveis por nenhum papel — trigger pode criar SLAs órfãos | Garantir que o trigger sempre seta `cliente_id` antes do INSERT |
| S5 | MÉDIO | `score_config`: SELECT aberto para qualquer usuário do cliente, mutação restrita a admin/supervisor — política assimétrica não documentada | Documentar e testar comportamento para papel `operador` |
| S6 | MÉDIO | `platform_admin` é dead value no enum mas persiste no banco — qualquer script legado pode criar usuário com esse papel | Criar constraint CHECK bloqueando INSERT/UPDATE com `platform_admin` |
| S7 | BAIXO | `canal_cidadao_rate_limit`: rate limit de 5 req/min por IP pode ser bypassado com rotação de IP em rede pública | Adicionar CAPTCHA ou honeypot no frontend da denúncia |

**SQL de correção urgente (S1):**
```sql
-- Migration: 20260402000000_fix_get_meu_papel_notificador.sql
CREATE OR REPLACE FUNCTION public.get_meu_papel()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT papel_app::text
  FROM usuarios
  WHERE auth_id = auth.uid()
  ORDER BY
    CASE papel_app::text
      WHEN 'admin'       THEN 10
      WHEN 'supervisor'  THEN 7
      WHEN 'moderador'   THEN 5
      WHEN 'notificador' THEN 3  -- CORREÇÃO: estava ausente
      WHEN 'operador'    THEN 2
      WHEN 'usuario'     THEN 1
      ELSE 0
    END DESC
  LIMIT 1
$$;
```

### 1.2 Permissões e Controle de Acesso

| ID | Problema | Correção |
|----|----------|----------|
| P1 | Dois guards paralelos com lógica idêntica: `AdminGuard` (em Admin.tsx) e `AdminOrSupervisorGuard` (em guards/) | Consolidar em um único `MunicipioGuard` |
| P2 | `OperadorGuard` bloqueia admin/supervisor de acessar rotas de operador para suporte/teste | Adicionar override para `isAdminOrSupervisor` |
| P3 | `/operador/rota` definida em App.tsx mas ausente em `OPERADOR_ALLOWED_PATHS` do AppLayout — agente é redirecionado ao acessar | Adicionar `/operador/rota` ao array |
| P4 | `isNotificador` não existe no AuthContext — NotificadorGuard faz comparação direta `papel === 'notificador'` sem normalização | Adicionar `isNotificador` ao AuthContext |
| P5 | `PAPEL_LABEL` definido em 3 lugares distintos | Centralizar em `src/lib/roles.ts` |

### 1.3 Fluxos Quebrados

| ID | Perfil | Problema | Correção |
|----|--------|----------|----------|
| F1 | Agente | Dois fluxos de vistoria paralelos (`/agente/vistoria` e `/operador/vistoria`) com componentes diferentes | Unificar sob `/agente/*` usando OperadorFormularioVistoria |
| F2 | Agente | Stepper de vistoria não exibe endereço do imóvel sendo vistoriado | Header fixo com logradouro + número |
| F3 | Agente | Finalização offline não gera feedback visual — agente pode repetir preenchimento | Toast "Salvo offline (ID: XXXX)" imediatamente |
| F4 | Notificador | Registro de caso falha sem Google Maps API (geocodificação obrigatória) | Campo de fallback lat/lng manual |
| F5 | Cidadão | Status de protocolo exibido em inglês técnico (`suspeita`, `em_triagem`) | Mapear para português cidadão antes do piloto |
| F6 | Cidadão | Rate limit atingido gera erro técnico sem mensagem amigável | Tratar `PGRST116` com mensagem clara |

### 1.4 Relatórios

| ID | Problema | Correção |
|----|----------|----------|
| R1 | Relatório semanal (Edge Function `relatorio-semanal`) não tem tela de preview no admin antes do envio | Adicionar botão "Visualizar relatório" em AdminSla |
| R2 | LIRAa não explica IIP/IBP para gestores não técnicos | Tooltips explicativos no AdminLiraa |
| R3 | PDF de notificação formal não tem logo da prefeitura configurável | Campo de upload de logo em AdminClientes |
| R4 | Boletim LIRAa (`liraa-export`) gera HTML — prefeituras esperam PDF | Converter para PDF usando `reportPdf.ts` como base |

### 1.5 Importação de Imóveis

Estado atual: **não existe**. Imóveis são cadastrados um a um via formulário.

Para implantar em prefeitura com cadastro imobiliário existente:

**Requisitos mínimos do importador:**
- Upload de CSV/XLSX com colunas: `logradouro`, `numero`, `complemento`, `bairro`, `quarteirao`, `cep`, `tipo_imovel`, `latitude` (opcional), `longitude` (opcional)
- Geocodificação automática dos registros sem lat/lng via Google Maps API
- Preview de erros antes de confirmar importação
- Limite: 5.000 imóveis por arquivo
- Deduplicação por `(logradouro, numero, bairro)` — não cria duplicatas

**Arquivos a criar:**
- `src/pages/admin/AdminImoveisImportacao.tsx` — rota `/admin/importacao-imoveis`
- `src/lib/importacaoImoveis.ts` — parser CSV + validação + geocodificação em lote
- `src/services/api.ts` — método `api.imoveis.importarLote(rows, clienteId)`
- `supabase/functions/geocoding-batch/index.ts` — geocodificação assíncrona em lote

### 1.6 Canal Cidadão

| ID | Problema | Correção |
|----|----------|----------|
| C1 | QR code gerado em AdminCanalCidadao não é imprimível diretamente | Botão "Imprimir cartaz" com layout A4 incluindo QR + instruções + telefone |
| C2 | URL do canal inclui bairroId (UUID) — visível na barra do browser e confusa para o cidadão | Implementar slug amigável ou short URL |
| C3 | Sem instrução visual sobre o que fotografar | Adicionar exemplo ilustrativo no formulário |
| C4 | Formulário não salva rascunho offline | localStorage preserva campos ao recarregar |
| C5 | Sem prazo de resposta comunicado ao cidadão | Texto pós-envio: "Nossa equipe atua em até 48 horas" |
| C6 | Aba "Denúncias" no admin não filtra por bairro nem por status de forma combinada | Filtros combinados com URL state |

### 1.7 Offline

| ID | Problema | Correção |
|----|----------|----------|
| O1 | Operação `save_vistoria` na fila offline não tem idempotency key — retry pode duplicar vistoria | Adicionar `idempotency_key = uuid()` gerado no cliente antes de enfileirar |
| O2 | Fila drena todas as operações em paralelo — pode causar conflito de ordem (deposito antes de create) | Drenar em série por `vistoria_id` |
| O3 | Agente não vê status individual das operações na fila (quais falharam, quais foram) | `SyncStatusPanel` com lista de operações pendentes/falhas |
| O4 | Operações na fila não têm TTL — uma vistoria de 30 dias atrás pode ser reenviada | TTL de 7 dias: operações mais antigas descartadas com aviso |

---

## 2. O QUE PRECISA EXISTIR PARA IMPLANTAR

### 2.1 Documentos Operacionais

Os documentos abaixo devem ser gerados antes da primeira reunião com a prefeitura:

#### Manual do Agente de Campo
**Público**: Agentes de Controle de Endemias
**Formato**: PDF imprimível + digital, linguagem simples, muitas imagens de tela
**Conteúdo**:
1. Instalando o app no celular / acessando pelo browser
2. Fazendo login
3. Entendendo a tela "Meu Dia"
4. Como visitar um imóvel
5. Preenchendo a vistoria passo a passo (etapas 1–5)
6. O que fazer quando não consegue entrar no imóvel
7. Usando o app sem internet (modo offline)
8. Sincronizando os dados ao retornar
9. FAQ — perguntas frequentes
10. Contato de suporte

#### Manual do Supervisor / Gestor Municipal
**Público**: Coordenadores municipais, diretores de vigilância
**Formato**: PDF + apresentação slides
**Conteúdo**:
1. Visão geral do dashboard — Central Operacional
2. Interpretando o mapa de focos
3. Acompanhando agentes em tempo real
4. Entendendo os indicadores LIRAa (IIP, IBP)
5. Gerenciando o SLA de atendimento
6. Revisando casos notificados e cruzamentos
7. Exportando relatórios para secretaria
8. Configurando alertas e notificações push
9. Gerenciando equipe (usuários e papéis)
10. FAQ

#### Manual do Notificador de Saúde
**Público**: Enfermeiros, médicos, agentes de UBS/UPA/hospital
**Formato**: PDF de 1 página (quick reference) + PDF completo
**Conteúdo**:
1. Acessando o sistema pela UBS
2. Registrando um novo caso (dengue / chikungunya / zika / suspeito)
3. O que informar e o que NÃO informar (regra LGPD)
4. Acompanhando casos registrados
5. O que acontece quando um caso cruza com um foco
6. Alterando o status de um caso
7. FAQ

#### Manual do Administrador da Plataforma
**Público**: TI da prefeitura, responsável técnico do contrato
**Formato**: PDF técnico com capturas de tela
**Conteúdo**:
1. Acessando o painel administrativo
2. Cadastrando e gerenciando usuários
3. Configurando regiões, bairros e quarteirões
4. Importando o cadastro de imóveis
5. Configurando unidades de saúde (CNES)
6. Configurando o canal cidadão (QR code por bairro)
7. Ajustando regras de SLA
8. Configurando integração com e-SUS Notifica
9. Monitorando o pipeline de drone
10. Acompanhando quotas e saúde do sistema
11. Backup e exportação de dados
12. Contato de suporte técnico Sentinella

#### Passo a Passo de Implantação
**Público**: Equipe técnica Sentinella + responsável TI prefeitura
**Formato**: Checklist detalhado com responsáveis

```
PRÉ-IMPLANTAÇÃO
[ ] Coletar CNPJ e dados cadastrais da prefeitura
[ ] Coletar código IBGE e UF do município
[ ] Definir domínio/subdomínio de acesso (app.prefeitura.gov.br/sentinella)
[ ] Criar cliente no banco via AdminClientes
[ ] Configurar UF + IBGE no cadastro do cliente
[ ] Definir papéis e identificar usuários por perfil
[ ] Coletar cadastro de imóveis (planilha modelo)
[ ] Coletar lista de unidades de saúde (ou sincronizar CNES)
[ ] Coletar lista de bairros e quarteirões

CONFIGURAÇÃO TÉCNICA
[ ] Criar usuários admin (1–2 por prefeitura)
[ ] Criar usuários supervisor/gestor
[ ] Criar usuários notificador (UBS por UBS)
[ ] Criar usuários operador (agente por agente)
[ ] Importar imóveis via AdminImoveisImportacao
[ ] Sincronizar unidades de saúde via CNES (botão na tela)
[ ] Cadastrar regiões e bairros
[ ] Cadastrar quarteirões e distribuição de agentes
[ ] Configurar SLA padrão (seed automático ao criar cliente)
[ ] Gerar QR codes do canal cidadão por bairro
[ ] Testar login de cada perfil

INTEGRAÇÃO (opcional)
[ ] Configurar e-SUS Notifica (API key + código IBGE + CNES)
[ ] Testar envio de caso para e-SUS em homologação
[ ] Configurar Web Push para gestores
[ ] Configurar drone (cadastro de drone + primeiro voo de teste)
```

#### Planilha Modelo de Importação de Imóveis
**Formato**: XLSX + CSV
**Colunas obrigatórias**:

| Coluna | Tipo | Exemplo | Observação |
|--------|------|---------|------------|
| logradouro | texto | Rua das Flores | sem abreviações |
| numero | texto | 123 | aceita "S/N" |
| complemento | texto | Apto 2 | opcional |
| bairro | texto | Centro | deve existir no cadastro |
| quarteirao | texto | Q01 | código do quarteirão |
| cep | texto | 79000-000 | 8 dígitos com ou sem hífen |
| tipo_imovel | texto | residencial | residencial / comercial / terreno / ponto_estrategico |
| latitude | decimal | -20.4697 | opcional — geocodificado automaticamente |
| longitude | decimal | -54.6201 | opcional — geocodificado automaticamente |

**Regras**:
- Máximo 5.000 linhas por arquivo
- Encoding: UTF-8
- Deduplicação por `(logradouro + numero + bairro)` — duplicatas ignoradas com aviso
- Imóveis sem lat/lng são geocodificados em lote (pode levar até 10 min para 5.000 registros)

#### Modelo de Contrato
**Público**: Jurídico da prefeitura + comercial Sentinella
**Cláusulas mínimas obrigatórias**:
1. Objeto do contrato (SaaS de monitoramento de endemias)
2. Vigência (mínimo 12 meses, renovação automática)
3. Licença de uso (por município, não transferível)
4. Limites de uso (número de usuários, imóveis, vistorias/mês, quota de armazenamento)
5. SLA de disponibilidade (uptime ≥ 99,5%)
6. Suporte técnico (horário, canais, tempo de resposta)
7. Tratamento de dados pessoais (LGPD — ver cláusula específica)
8. Responsabilidade das partes (dados inseridos são de responsabilidade do município)
9. Propriedade intelectual (sistema pertence à Sentinella; dados pertencem ao município)
10. Rescisão e portabilidade de dados (exportação em formato aberto em até 30 dias após rescisão)
11. Foro (cidade-sede do município contratante)

#### Política LGPD
**Documento separado** vinculado ao contrato:

**Dados tratados pelo Sentinella**:
- `usuarios`: nome, e-mail, telefone (dados dos agentes — funcionários públicos)
- `casos_notificados`: endereço residencial do paciente, bairro, data de início de sintomas — **sem nome, CPF ou data de nascimento**
- `vistorias`: endereço do imóvel, dados de acesso (sem dados pessoais dos moradores além de contagem)
- `denuncias_cidadao` (focos_risco origem cidadão): endereço do local denunciado, descrição do problema, foto do local — **sem identificação do denunciante**

**Fundamentos legais (LGPD Art. 7)**:
- Execução de política pública de saúde (Art. 7, III)
- Legítimo interesse do município na vigilância sanitária (Art. 7, IX)
- Consentimento para Web Push (Art. 7, I)

**Retenção**:
- Dados operacionais (vistorias, focos): 5 anos (vigilância epidemiológica)
- Logs de sistema: 1 ano
- Dados de usuário: enquanto o vínculo empregatício existir

**Direitos dos titulares**:
- Agentes/funcionários: podem solicitar acesso, correção e exclusão via admin
- Pacientes: os dados armazenados não permitem identificação — direito de exclusão não aplicável (dados anônimos por design)

#### Apresentação Comercial
**Público**: Secretários de saúde, prefeitos, coordenadores
**Formato**: PowerPoint / Google Slides — 15 slides
**Estrutura**:
1. O problema (dengue no Brasil: números, custos, municípios afetados)
2. A solução Sentinella (visão geral em 3 frases)
3. Como funciona (fluxo visual: drone → análise → agente → resolução)
4. Para cada perfil (agente, gestor, notificador) — 1 slide cada
5. Canal Cidadão (engajamento da população)
6. Indicadores gerados (LIRAa, score de risco, SLA)
7. Integração com e-SUS Notifica
8. Offline-first para campo sem internet
9. Segurança e LGPD
10. Implantação em 6 semanas
11. Casos de uso (mockup de dashboard com dados fictícios)
12. Planos e preços
13. Próximos passos

---

## 3. ROTEIRO DE IMPLANTAÇÃO

### Visão Geral

```
Semana 1   Semana 2   Semana 3   Semana 4   Semana 5   Semana 6
   │          │          │          │          │          │
Kickoff    Config    Treinamento  Piloto     Ajustes   Operação
  +          +          +           +          +          +
Coleta    Importação  Agentes    Validação  Correções  Go-Live
dados     imóveis     Gestores   silenciosa  finais    oficial
```

---

### Semana 1 — Kickoff e Levantamento

**Objetivo**: Entender o contexto municipal e coletar todos os dados necessários.

**Atividades**:
- Reunião de kickoff com secretário de saúde + coordenador de endemias + TI
- Apresentação do sistema (demo ao vivo — ambiente de staging)
- Levantamento de:
  - Número de agentes, supervisores, notificadores
  - Lista de bairros e quarteirões (planilha ou shapefile)
  - Cadastro de imóveis (exportação do sistema existente)
  - Lista de unidades de saúde (ou confirmar uso de CNES automático)
  - Fluxo atual de trabalho (como fazem hoje sem o sistema)
  - Ciclo atual (de 1 a 6) e início do próximo ciclo
- Definição de responsável técnico municipal (ponto focal)
- Assinatura do contrato e DPA (LGPD)
- Acesso ao ambiente de produção (Supabase project, domínio)

**Entregáveis da Sentinella**:
- Acesso ao ambiente do cliente criado
- Planilha modelo de imóveis enviada
- Credenciais admin enviadas ao ponto focal

**Responsável municipal**: Preencher planilha de imóveis + lista de usuários

---

### Semana 2 — Configuração e Importação

**Objetivo**: Sistema configurado com dados reais do município.

**Atividades (equipe Sentinella)**:
- Cadastrar cliente com UF + IBGE + logo
- Criar regiões e bairros conforme mapa municipal
- Criar quarteirões e configurar distribuição padrão
- Importar cadastro de imóveis (lote de até 5.000)
  - Validar geocodificação
  - Corrigir erros de endereço
  - Revisar com ponto focal municipal
- Sincronizar unidades de saúde via CNES
  - Validar lista com coordenador
  - Adicionar unidades privadas conveniadas manualmente
- Criar todos os usuários por perfil
  - Notificadores: 1 por UBS + UPA + hospital
  - Operadores: todos os agentes de campo
  - Supervisores: coordenadores + diretores
- Configurar SLA (revisar padrões, ajustar se necessário)
- Gerar QR codes do canal cidadão (1 por bairro + 1 genérico)
- Configurar e-SUS (se disponível)
- Teste de smoke completo (todos os perfis, todos os fluxos)

**Entregáveis da Sentinella**:
- Sistema configurado e validado
- Relatório de importação (X imóveis importados, Y erros corrigidos)
- Credenciais de todos os usuários enviadas ao ponto focal
- QR codes em PDF prontos para impressão

---

### Semana 3 — Treinamento

**Objetivo**: Todos os usuários sabem usar o sistema com confiança.

**Formato recomendado**: Treinamentos presenciais de 2h, agrupados por perfil.

| Dia | Turma | Duração | Local |
|-----|-------|---------|-------|
| Seg | Gestores e Supervisores | 3h | Sala de reunião da Secretaria |
| Ter manhã | Notificadores (UBS lote 1) | 2h | Sala de reunião ou UBS central |
| Ter tarde | Notificadores (UBS lote 2) | 2h | Idem |
| Qua manhã | Agentes turno A | 2h | Sala ampla |
| Qua tarde | Agentes turno B | 2h | Sala ampla |
| Qui | Administradores TI | 4h | Laboratório de informática |
| Sex | Revisão e dúvidas | 2h | Online (Google Meet) |

**Material de apoio**:
- Manual impresso por perfil (1 por agente)
- QR code do treinamento (vídeo de 5 min gravado para consulta posterior)
- Cartão de bolso (plastificado A5): fluxo resumido do dia do agente

**Exercício prático obrigatório para agentes**:
- Cada agente realiza 1 vistoria completa em imóvel fictício (dummy data)
- Teste de modo offline: desliga o WiFi e finaliza a vistoria, sincroniza depois
- Treinador valida que dados chegaram no dashboard do supervisor

---

### Semana 4 — Piloto Silencioso

**Objetivo**: Operação real com suporte próximo, sem pressão de resultados.

**Regras do piloto**:
- Sistema paralelo ao processo atual (agentes ainda preenchem planilha papel + sistema)
- Foco em 1 região ou 2 bairros (não o município todo)
- Meta: 50–100 vistorias reais no sistema
- 2–3 casos notificados via sistema (notificadores treinados)
- 1 denúncia cidadão real por bairro (QR code na UBS piloto)

**Acompanhamento diário (Sentinella)**:
- Revisar erros de sincronização offline
- Monitorar `sla_erros_criacao` e `pipeline_runs`
- Ligar/WhatsApp com ponto focal ao fim de cada dia
- Ajustes pequenos sem deploy (configurações, textos)

**Indicadores de sucesso do piloto**:
- ≥ 80% das vistorias finalizadas sem erro
- ≤ 5% de falhas de sincronização offline
- Supervisor consegue ver mapa de focos do dia
- Pelo menos 1 cruzamento caso↔foco gerado automaticamente
- Nenhum dado entre clientes diferentes (teste de isolamento)

---

### Semana 5 — Ajustes Pós-Piloto

**Objetivo**: Corrigir os atritos identificados antes do go-live.

**Atividades**:
- Reunião de retrospectiva com todos os perfis (1h)
- Priorizar lista de ajustes por criticidade
- Aplicar correções de configuração (sem deploy se possível)
- Ajustes que exigem deploy: agendar janela de manutenção
- Revisão dos manuais com base no feedback real
- Treinamento de reforço para grupos com dificuldade
- Calibrar SLA e alertas com base nos dados reais coletados
- Definir protocolo de suporte pós-go-live (canal, horário, SLA de resposta)

**Checklist de aprovação para go-live**:
- [ ] Todos os agentes fizeram pelo menos 5 vistorias com sucesso
- [ ] Supervisor vê dados em tempo real no mapa
- [ ] Notificador registrou pelo menos 1 caso real
- [ ] Canal cidadão testado com 2–3 denúncias reais
- [ ] Offline funcionando: vistoria enfileirada e sincronizada
- [ ] SLA configurado e gerando alertas corretos
- [ ] Relatório semanal automático recebido e validado
- [ ] Backup/exportação de dados testado
- [ ] Responsável TI consegue criar usuário sozinho

---

### Semana 6 — Go-Live e Operação

**Objetivo**: Município opera de forma autônoma com suporte de plantão.

**Atividades no dia do go-live**:
- Comunicado oficial da Secretaria para toda a equipe
- Suspensão do processo paralelo (planilha papel) para as regiões implantadas
- Distribuição dos QR codes do canal cidadão (postos, escolas, igrejas)
- Reunião de 30 min no início do turno com agentes
- Suporte Sentinella em standby (resposta em até 2h)

**Operação normal (pós semana 6)**:
- Suporte via WhatsApp Business ou Helpdesk (SLA: 4h úteis)
- Deploy de correções críticas: sem janela (emergência)
- Deploy de melhorias: toda segunda-feira, 22h–23h
- Reunião mensal de acompanhamento (KPIs, feedbacks, roadmap)
- Relatório automático semanal entregue ao secretário toda segunda

---

## 4. RISCOS DO PROJETO

### 4.1 Riscos Técnicos

| ID | Risco | Probabilidade | Impacto | Mitigação |
|----|-------|--------------|---------|-----------|
| T1 | Cadastro de imóveis municipal incompleto ou desatualizado | Alta | Alto | Aceitar cadastro parcial + importação incremental; agente cadastra em campo |
| T2 | Geocodificação falha para endereços rurais ou informais (favelas, chacháras) | Média | Médio | Importação com lat/lng manual; agente faz checkin GPS ao chegar no local |
| T3 | Celulares dos agentes com Android antigo (<7.0) ou pouca memória | Média | Alto | Testar com dispositivo mais antigo disponível; fallback para browser sem PWA |
| T4 | Conexão instável em campo (zona rural, interior de edificações) | Alta | Alto | Offline-first já implementado; revisar TTL da fila (problema O4) |
| T5 | CNES sync falha por indisponibilidade da API do DATASUS | Média | Baixo | Cadastro manual como fallback; CNES não é bloqueante para operação |
| T6 | Supabase quota atingida durante pico (ciclo LIRAa) | Baixa | Alto | Configurar alerta em 70% (QuotaBanner já existe); upgrade de plano antes do ciclo |
| T7 | Bug na RLS permitindo vazamento de dados entre clientes | Baixa | Crítico | Auditoria RLS concluída; teste de isolamento no piloto; monitorar logs |
| T8 | Perda de vistorias offline por TTL ou falha de drain | Baixa | Alto | Implementar O1 (idempotency key) e O4 (TTL 7 dias) antes do piloto |

### 4.2 Riscos Operacionais

| ID | Risco | Probabilidade | Impacto | Mitigação |
|----|-------|--------------|---------|-----------|
| O1 | Agentes não adotam o sistema e continuam usando papel | Alta | Crítico | Treinamento prático obrigatório; supervisor valida vistorias no sistema; gestor vê apenas dados do sistema |
| O2 | Alta rotatividade de agentes durante o contrato | Alta | Médio | Processo de onboarding simplificado (<30 min); manual de 1 página; admin cria usuário em segundos |
| O3 | Supervisor não monitora o dashboard e perde alertas de SLA | Média | Alto | Web Push configurado; relatório semanal automático; reunião mensal de KPIs |
| O4 | Notificadores de UBS não registram casos (resistência cultural) | Alta | Alto | Integração com fluxo existente; notificador registra direto da ficha de atendimento |
| O5 | Prefeitura não mantém cadastro de imóveis atualizado | Alta | Médio | Processo de inclusão em campo (agente cadastra imóvel novo na vistoria) |
| O6 | Mudança de gestão municipal (eleição) interrompe projeto | Média | Alto | Contrato com vigência determinada; dados exportáveis; continuidade independe de cargo político |
| O7 | Equipe de TI municipal inexistente ou sobrecarregada | Média | Médio | Ponto focal pode ser não-TI (coordenador treinado); operações complexas feitas pela Sentinella remotamente |

### 4.3 Riscos de Negócio

| ID | Risco | Probabilidade | Impacto | Mitigação |
|----|-------|--------------|---------|-----------|
| N1 | Prefeitura quer customizações antes de assinar | Alta | Médio | Definir escopo claro; customizações entram no roadmap pago; piloto com produto padrão |
| N2 | Concorrência com sistemas gratuitos federais (e-SUS Território) | Média | Alto | Diferenciar pelo drone, canal cidadão, score de risco e suporte local |
| N3 | Inadimplência ou cancelamento após implantação | Baixa | Alto | Cláusula de rescisão com aviso prévio de 60 dias; exportação de dados garantida |
| N4 | Escalonamento rápido (10+ municípios simultâneos) sobrecarrega suporte | Média | Alto | Documentação completa reduz tickets; suporte tier 1 terceirizado por município |
| N5 | Falha em integração e-SUS afeta credibilidade junto à Vigilância Estadual | Baixa | Alto | Integração opcional; modo standalone funciona sem e-SUS |
| N6 | LGPD: denúncia de vazamento de dados | Muito Baixa | Crítico | Dados anonimizados por design; RLS auditada; DPO responsável documentado |

---

## 5. ROADMAP DO PRODUTO

### Versão 1.0 — Vigilância de Campo (atual → Go-Live)

**Prazo**: Q2 2026 (piloto) → Q3 2026 (municípios)

**O que está completo**:
- Cadastro de imóveis + importação em lote
- Vistoria de campo (stepper 5 etapas, PNCD A1–E)
- Modo offline com fila IndexedDB
- Focos de risco (state machine 7 estados)
- LIRAa (IIP, IBP, quarteirão)
- Canal cidadão (QR code + denúncia pública + protocolo)
- Casos notificados + cruzamento automático com focos (PostGIS)
- Score territorial de risco por imóvel
- SLA operacional com alertas Web Push
- Relatório semanal automático (e-mail)
- Integração e-SUS Notifica
- Pipeline de drone + análise YOLO

**Correções obrigatórias antes do go-live** (ver Seção 1):
- S1: Fix get_meu_papel() notificador
- S2: Fix drones cross-tenant
- F1–F6: Fluxos quebrados
- O1–O4: Offline robustez
- C1–C6: Canal cidadão

**KPI de sucesso da v1.0**:
- 3 municípios ativos no Q3 2026
- ≥ 200 vistorias/semana por município
- SLA médio < 24h para focos P1

---

### Versão 1.5 — Automação e Inteligência (Q4 2026)

**Foco**: Reduzir trabalho manual dos gestores, aumentar cobertura automática.

**Funcionalidades**:

#### 1.5.1 — Distribuição Automática de Quarteirões
- Algoritmo de balanceamento de carga por agente + área geográfica
- Considera: histórico de cobertura, score de risco do quarteirão, disponibilidade do agente
- Gestor aprova a distribuição gerada, pode ajustar manualmente

#### 1.5.2 — Planejamento de Voo de Drone com IA
- Sugere área de voo baseado em: score de risco elevado + clusters de focos + janela climática favorável
- Integra com histórico de voos para evitar sobreposição desnecessária
- Exporta polígono KML para app de voo

#### 1.5.3 — Notificação Formal Automatizada
- Após 3ª tentativa sem acesso em imóvel: gera PDF de notificação formal automaticamente
- Gestor revisa e assina digitalmente (assinatura GOV.BR ou certificado ICP-Brasil)
- Arquivo enviado por e-mail ao responsável (se cadastrado)

#### 1.5.4 — App Mobile Nativo (React Native)
- PWA atual funciona mas com limitações em câmera, GPS e background sync
- App nativo melhora: captura de foto de alta resolução, GPS mais preciso, sync em background sem abrir browser
- Plataformas: Android (obrigatório) + iOS (opcional — prefeituras usam Android)
- Distribuição via APK direto (sem Google Play para evitar aprovação)

#### 1.5.5 — Painel Epidemiológico Avançado
- Mapa de calor semanal/mensal com evolução animada
- Curva epidêmica por bairro (casos vs. focos)
- Alerta de possível surto: score > limiar por 3 semanas consecutivas
- Export para SINAN via e-SUS Notifica (automático, não manual)

**KPI de sucesso da v1.5**:
- 10 municípios ativos
- Redução de 30% no tempo de distribuição de quarteirões (vs. manual)
- App nativo com rating ≥ 4,0 pelos agentes

---

### Versão 2.0 — Plataforma Multi-Endemia (Q2 2027)

**Foco**: Expandir além do Aedes aegypti para outras endemias e vetores.

**Funcionalidades**:

#### 2.0.1 — Suporte a Múltiplas Endemias
- Esquistossomose: mapeamento de coleções d'água + focos de Biomphalaria
- Leishmaniose: mapeamento de vetores (Lutzomyia) + casos caninos + humanos
- Leptospirose: mapeamento de áreas de risco + eventos de enchente
- Chagas: mapeamento de barbeiros + imóveis com risco estrutural
- Cada endemia tem: formulário de vistoria próprio, indicadores próprios, integração específica com SINAN

#### 2.0.2 — Módulo de Educação em Saúde
- Canal cidadão bidirecional: além de receber denúncias, envia orientações por região
- Campanhas: gestor cadastra mensagem + área alvo → cidadãos que denunciaram naquela área recebem push
- Material educativo: PDF/vídeo anexado à confirmação de denúncia
- Gamificação básica: contador de denúncias por bairro visível no canal cidadão

#### 2.0.3 — Integração GIS Municipal
- Importar shapefile de quadras, logradouros e lotes do município
- Vincular imóvel ao lote do cadastro imobiliário municipal
- Exportar dados para sistemas GIS como QGIS ou ArcGIS

#### 2.0.4 — API Pública para Estados e Ministério
- Endpoint REST autenticado para Secretaria Estadual consultar indicadores agregados por município
- Dashboard estadual: ranking de IIP, cobertura de vistorias, SLA médio, surtos em alerta
- Feed de dados para o Ministério da Saúde (SIVEP, SINAN, SVS)

#### 2.0.5 — Modelo de Receita Expandido
- Tier Município: até 50.000 imóveis, até 100 usuários
- Tier Estado: painel estadual com N municípios, API pública
- Tier Ministério: acesso nacional, relatórios consolidados, integração SINAN automatizada

**KPI de sucesso da v2.0**:
- 30+ municípios ativos
- 3 endemias cobertas além de dengue
- 1 contrato estadual ativo
- NPS ≥ 50 junto a gestores municipais

---

### Versão 3.0 — Inteligência Preditiva e Resposta Automatizada (2028+)

**Foco**: Transformar o Sentinella de sistema reativo em sistema preditivo.

#### 3.0.1 — Modelo Preditivo de Surto
- Machine learning treinado com histórico de focos + casos + clima + coberturas
- Prediz probabilidade de surto por bairro nas próximas 2–4 semanas
- Input: vistoria, clima, LIRAa, densidade populacional, coberturas anteriores
- Output: score 0–100 por bairro + recomendação de ação (intensificar cobertura, voo de drone, alerta cidadãos)

#### 3.0.2 — Resposta Automatizada
- Quando surto é previsto com alta confiança: cria planejamento automático de intensificação
- Agenda voo de drone para área de risco sem intervenção humana
- Notifica agentes com lista priorizada de imóveis para o dia seguinte
- Ativa canal cidadão automaticamente para bairro em alerta

#### 3.0.3 — Identidade Visual do Cidadão (app)
- App autônomo para o cidadão (não apenas página pública)
- Cidadão acompanha status de suas denúncias com notificações push
- Vê mapa de focos do seu bairro (dados anonimizados)
- Recebe alertas de campanha da prefeitura
- Gamificação: rank de bairros mais engajados

#### 3.0.4 — Marketplace de Módulos
- Prefeituras podem ativar módulos adicionais (drone, IA, e-SUS, GIS)
- Parceiros tecnológicos podem integrar (fabricantes de drone, laboratórios, DATASUS)
- Modelo de revenue share para integrações de terceiros

**KPI de sucesso da v3.0**:
- 100+ municípios ativos
- Modelo preditivo com acurácia ≥ 75% em teste retrospectivo
- Redução mensurável de 15–20% em casos de dengue em municípios com cobertura plena (publicação científica)

---

## Apêndice — Checklist de Pré-Piloto (síntese)

### Segurança (bloqueante)
- [ ] S1: Fix get_meu_papel() notificador deployado
- [ ] S2: Fix drones cross-tenant deployado
- [ ] S3: CLEANUP-04 (remover policies duplicadas legadas) executado
- [ ] Teste de isolamento: usuário do cliente A não vê dados do cliente B

### Permissões (bloqueante)
- [ ] P3: `/operador/rota` adicionado ao OPERADOR_ALLOWED_PATHS
- [ ] P4: `isNotificador` adicionado ao AuthContext
- [ ] Fluxo notificador testado end-to-end com papel correto

### Fluxos (bloqueante)
- [ ] F1: Rotas agente unificadas
- [ ] F2: Header com endereço no stepper
- [ ] F3: Toast offline ao finalizar vistoria
- [ ] F4: Fallback geocodificação no NotificadorRegistroCaso
- [ ] F5: Status de protocolo em português cidadão
- [ ] F6: Erro de rate limit com mensagem amigável

### Offline (bloqueante)
- [ ] O1: Idempotency key na fila de vistorias
- [ ] O2: Drain serial por vistoria_id
- [ ] O4: TTL 7 dias implementado

### Canal Cidadão (bloqueante)
- [ ] C1: Cartaz imprimível com QR gerado
- [ ] C3: Instrução "o que fotografar" no formulário
- [ ] C5: Prazo de resposta comunicado pós-denúncia

### Documentos (bloqueante para reunião)
- [ ] Manual do Agente
- [ ] Manual do Supervisor
- [ ] Manual do Notificador
- [ ] Manual do Administrador
- [ ] Planilha modelo de imóveis
- [ ] Contrato + DPA LGPD
- [ ] Apresentação comercial (15 slides)
