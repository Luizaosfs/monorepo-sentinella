# MÉTODO DE IMPLANTAÇÃO SENTINELLA
**Versão:** 1.0
**Data:** 2026-04-02
**Validade:** Revisão semestral

---

## VISÃO GERAL

O Método de Implantação Sentinella é o processo padronizado para colocar uma nova prefeitura em operação plena em até **90 dias**, divididos em 3 fases de 30 dias cada.

| Fase | Período | Objetivo |
|---|---|---|
| Fase 1 — Setup | Dias 1–30 | Plataforma configurada, usuários criados, imóveis importados |
| Fase 2 — Piloto | Dias 31–60 | Operação real com suporte intensivo |
| Fase 3 — Autonomia | Dias 61–90 | Supervisor opera de forma independente |

**Critério de aprovação:** Supervisor e agentes operam sem suporte técnico ao fim do Dia 90.

---

## PRÉ-REQUISITOS (antes do Dia 1)

### Da prefeitura
- [ ] Contrato assinado
- [ ] Responsável técnico municipal indicado (supervisor)
- [ ] Lista de agentes de campo com e-mails válidos
- [ ] Planilha de imóveis (mínimo: logradouro, número, bairro)
- [ ] Código IBGE do município (7 dígitos)
- [ ] UF do município (2 letras)
- [ ] Lista de feriados municipais do ano vigente

### Da Sentinella
- [ ] Ambiente de produção provisionado no Supabase
- [ ] Domínio configurado (app.sentinella.com.br ou whitelabel)
- [ ] Credenciais de admin geradas para o suporte técnico
- [ ] Slot de implantação reservado no calendário do time

---

## FASE 1 — SETUP (Dias 1–30)

### Semana 1 — Dias 1–7

#### Dia 1 (remoto, 2–4h)
**Responsável:** Suporte técnico Sentinella

**Configuração da plataforma:**
1. Criar cliente em `/admin/clientes` (nome, UF, IBGE)
2. Confirmar seed automático: quotas, SLA padrão, score config, feriados nacionais
3. Adicionar feriados municipais em `/admin/sla-feriados`
4. Cadastrar regiões e bairros da área de operação
5. Criar conta do supervisor municipal (papel: `supervisor`)
6. Enviar link de primeiro acesso ao supervisor

**Verificações:**
- [ ] `cliente_id` gerado e anotado
- [ ] Supervisor recebeu e acessou o link
- [ ] Supervisor completou o OnboardingModal
- [ ] Sidebar do supervisor mostra apenas itens da operação (não `/admin/clientes`)

#### Dias 2–5
**Importação de imóveis:**
1. Receber planilha da prefeitura
2. Limpar dados: remover duplicatas, endereços sem número, CEPs inválidos
3. Padronizar colunas: `logradouro, numero, complemento, bairro, quarteirao, latitude, longitude, tipo_imovel`
4. Geocodificar endereços sem coordenadas (Google Maps API ou IBGE)
5. Revisar amostra de 50 imóveis com o supervisor antes de importar
6. Upload do CSV em `/admin/importar-imoveis`
7. Conferir contagem e erros reportados
8. Confirmar amostra em `/admin/imoveis`

**Padrão mínimo de qualidade:**
- < 5% de registros com erro de geocodificação
- 100% dos imóveis vinculados a um bairro cadastrado
- Nenhum imóvel sem quarteirão (se a prefeitura usar distribuição por quarteirão)

#### Dias 6–7
**Configuração operacional:**
1. Cadastrar quarteirões em `/admin/distribuicao-quarteirao`
2. Abrir o primeiro ciclo em `/admin/ciclos`
3. Sincronizar CNES em `/admin/unidades-saude` → "Sincronizar agora"
4. Confirmar que UBSs do município aparecem na lista
5. Criar contas dos agentes de campo (papel: `operador`)
6. Criar contas dos notificadores das UBSs (papel: `notificador`)
7. Enviar credenciais para todos os usuários

### Semana 2 — Dias 8–14 (Treinamento)

#### Dia 8 — Treinamento do supervisor (4h)
Ver roteiro completo em `TREINAMENTO_SUPERVISOR.md`.

Tópicos obrigatórios:
- [ ] Central do Dia (`/gestor/central`) — KPIs e leitura diária
- [ ] Gestão de focos (`/gestor/focos`) — transições de estado
- [ ] Mapa e heatmap (`/gestor/mapa`)
- [ ] Monitoramento de SLA
- [ ] LIRAa e score territorial
- [ ] Relatório semanal automático
- [ ] Notificações push no navegador

#### Dias 9–10 — Treinamento dos agentes (1–2h cada)
Ver roteiro completo em `TREINAMENTO_AGENTE.md`.

Tópicos obrigatórios:
- [ ] Meu Dia (`/agente/hoje`)
- [ ] Lista de imóveis e busca
- [ ] Vistoria completa (5 etapas)
- [ ] Fluxo sem acesso
- [ ] Modo offline: desligar Wi-Fi → vistoriar → religar → sincronizar
- [ ] 1 vistoria real supervisionada por agente

#### Dia 11 — Treinamento dos notificadores (2h)
Ver roteiro completo em `TREINAMENTO_NOTIFICADOR.md`.

#### Dias 12–14 — Teste operacional supervisionado
- [ ] Supervisor cria planejamento de vistoria
- [ ] 2 agentes executam vistoria real em 5 imóveis cada
- [ ] Supervisor acompanha em tempo real (`/admin/supervisor-tempo-real`)
- [ ] Notificador registra 1 caso de teste
- [ ] Verificar cruzamento foco ↔ caso (banner no foco)
- [ ] Testar denúncia cidadão via QR (gerar em `/admin/canal-cidadao`)
- [ ] Confirmar notificação push chegou ao supervisor

### Semana 3–4 — Dias 15–30 (Operação Assistida Inicial)

**Rotina diária de suporte:**
- Manhã: verificar `/admin/saude-sistema` — erros ou jobs travados
- Tarde: disponível no WhatsApp para dúvidas dos agentes e supervisor
- Ao fim do dia: revisar imóveis com coordenadas erradas reportados pelos agentes

**Verificações semanais:**
- [ ] Taxa de sincronização offline ≥ 95%
- [ ] SLA médio dentro dos limites configurados
- [ ] Supervisor lendo a Central do Dia diariamente
- [ ] Zero erros críticos (P0) sem resolução

---

## FASE 2 — PILOTO (Dias 31–60)

### Objetivo
Prefeitura em operação real com dados reais. Suporte ativo mas não cotidiano.

### Semana 5–6 — Dias 31–45

**Ritmo de suporte:** 2×/semana (check-in proativo)

**Ações:**
- [ ] Primeiro relatório semanal automático recebido e lido pelo supervisor
- [ ] Score territorial visível e interpretado pelo supervisor
- [ ] LIRAa calculado para o primeiro ciclo em andamento
- [ ] Supervisor usa planejamentos semanais de forma autônoma
- [ ] Agentes não precisam de suporte para vistoria padrão

**Coleta de dados para o relatório de piloto:**
- Preencher semanalmente o `RELATORIO_PILOTO.md`
- Fotografar heatmap ao fim de cada semana

### Semana 7–8 — Dias 46–60

**Ritmo de suporte:** 1×/semana (reunião de revisão)

**Ações:**
- [ ] Primeiro snapshot de billing gerado (`/admin/quotas`)
- [ ] Confirmar que quotas do plano não foram ultrapassadas
- [ ] Coletar feedback estruturado de cada perfil (formulário + reunião)
- [ ] Ajustar score territorial se necessário (`/admin/score-config`)
- [ ] Documentar incidentes ocorridos

---

## FASE 3 — AUTONOMIA (Dias 61–90)

### Objetivo
Supervisor opera sem suporte técnico. Sentinella em papel de suporte reativo.

### Semana 9–10 — Dias 61–75

**Ritmo de suporte:** Somente incidentes

**Verificações:**
- [ ] Supervisor enviou planejamento sem auxílio
- [ ] Supervisor interpretou e agiu com base no LIRAa
- [ ] Relatório de piloto preenchido com dados reais
- [ ] Todos os agentes sincronizando offline sem problemas

### Semana 11–12 — Dias 76–90 (Conclusão)

**Reunião de encerramento do piloto:**
- [ ] Apresentar `RELATORIO_PILOTO.md` preenchido
- [ ] Discutir valor percebido e ROI
- [ ] Acordar próximos passos: renovar, expandir, integrar drone/e-SUS
- [ ] Assinatura da renovação ou upgrade de plano (se piloto)
- [ ] Definir plano de suporte contínuo (ver `PLANO_SUPORTE_SENTINELLA.md`)

---

## CRITÉRIOS DE SUCESSO

| Métrica | Meta | Verificado em |
|---|---|---|
| Agentes autônomos | 100% | Dia 30 |
| Vistorias sem suporte técnico | > 80% | Dia 45 |
| Taxa de sincronização offline | > 95% | Dia 30 |
| Supervisor usando Central do Dia diariamente | Sim | Dia 45 |
| Relatório semanal lido | Sim | Dia 45 |
| Zero vazamento cross-tenant | Confirmado | Dia 7 |
| Prefeitura renova / contrata plano pago | Sim | Dia 90 |

---

## ESCALONAMENTO DE PROBLEMAS

| Tipo | Ação | Responsável |
|---|---|---|
| Usuário esqueceu senha | Resetar via Supabase Auth | Suporte técnico |
| Imóvel sem coordenada | Corrigir manualmente via `/admin/imoveis` | Suporte técnico |
| Sincronização offline travada | Checar IndexedDB no DevTools; limpar fila se necessário | Suporte técnico |
| Erro de importação de imóveis | Revisar CSV; re-importar somente registros faltantes | Suporte técnico |
| CNES não sincronizou | Verificar UF+IBGE no cliente; re-executar manualmente | Suporte técnico |
| SLA disparou sem motivo | Verificar trigger `trg_foco_sla_criacao`; checar `sla_erros_criacao` | Dev técnico |
| Foco não criado após vistoria | Checar `job_queue` → jobs pendentes ou com erro | Dev técnico |

---

## CONTROLE DE IMPLANTAÇÃO

| Campo | Valor |
|---|---|
| Prefeitura | __________ |
| UF | __ |
| IBGE | _______ |
| Data de início | __________ |
| Plano contratado | __________ |
| Responsável Sentinella | __________ |
| Responsável prefeitura | __________ |
| Data prevista de conclusão | __________ |
| Status atual | __________ |
