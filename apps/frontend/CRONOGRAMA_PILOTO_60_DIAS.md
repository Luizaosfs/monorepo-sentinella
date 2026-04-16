# CRONOGRAMA DO PILOTO — 60 DIAS
**Prefeitura:** ___________________________
**Data de início:** ___________________________
**Responsável Sentinella:** ___________________________
**Supervisor municipal:** ___________________________
**Versão:** 1.0 — 2026-04-02

---

## VISÃO GERAL

| Fase | Período | Foco |
|---|---|---|
| Semana 1 — Setup | Dias 1–7 | Plataforma configurada, usuários criados, imóveis importados |
| Semana 2 — Treinamento | Dias 8–14 | Todos os perfis treinados, teste operacional supervisionado |
| Semanas 3–4 — Operação assistida | Dias 15–30 | Operação real com suporte diário |
| Semanas 5–8 — Operação autônoma | Dias 31–60 | Supervisor opera sozinho, suporte reativo |

---

## SEMANA 1 — SETUP (Dias 1–7)

### Dia 1 — Configuração da plataforma
**Responsável:** Suporte técnico Sentinella
**Duração estimada:** 2–3h (remoto)

| Tarefa | Status |
|---|---|
| Criar cliente em `/admin/clientes` (nome, UF, IBGE) | [ ] |
| Confirmar seed automático (quotas, SLA, score, feriados nacionais) | [ ] |
| Cadastrar feriados municipais em `/admin/sla-feriados` | [ ] |
| Cadastrar regiões e bairros da área de operação | [ ] |
| Criar conta do supervisor municipal | [ ] |
| Enviar link de primeiro acesso ao supervisor | [ ] |
| Supervisor confirmou acesso e concluiu OnboardingModal | [ ] |

**Anotações do dia 1:**
_______________________________________________

---

### Dias 2–4 — Importação de imóveis
**Responsável:** Suporte técnico Sentinella + responsável da prefeitura

| Tarefa | Status |
|---|---|
| Receber planilha de imóveis da prefeitura | [ ] |
| Padronizar colunas: logradouro, numero, bairro, quarteirao, lat, lng | [ ] |
| Geocodificar imóveis sem coordenadas GPS | [ ] |
| Revisar amostra de 50 imóveis com o supervisor | [ ] |
| Upload do CSV em `/admin/importar-imoveis` | [ ] |
| Verificar contagem importada e erros | [ ] |
| Confirmar amostra em `/admin/imoveis` | [ ] |

**Total de imóveis importados:** _______
**Erros de geocodificação:** _______ (< 5% é aceitável)

---

### Dias 5–7 — Configuração operacional e usuários
**Responsável:** Suporte técnico + supervisor municipal

| Tarefa | Status |
|---|---|
| Cadastrar quarteirões em `/admin/distribuicao-quarteirao` | [ ] |
| Distribuir quarteirões entre agentes | [ ] |
| Abrir primeiro ciclo em `/admin/ciclos` | [ ] |
| Sincronizar CNES em `/admin/unidades-saude` | [ ] |
| Confirmar UBSs e postos na lista | [ ] |
| Criar contas dos agentes de campo (papel: operador) | [ ] |
| Criar contas dos notificadores das UBSs (papel: notificador) | [ ] |
| Enviar credenciais para todos os usuários | [ ] |
| Confirmar acesso de todos os agentes nos seus dispositivos | [ ] |

**Agentes cadastrados:** _______
**Notificadores cadastrados:** _______

---

## SEMANA 2 — TREINAMENTO (Dias 8–14)

### Dia 8 — Treinamento do supervisor (4h)
**Responsável:** Suporte técnico Sentinella
**Formato:** Vídeo ou presencial

Seguir roteiro em `TREINAMENTO_SUPERVISOR.md`

| Módulo | Concluído? |
|---|---|
| Acesso e navegação | [ ] |
| Central do Dia | [ ] |
| Focos de Risco (transições de estado) | [ ] |
| Mapa e heatmap | [ ] |
| SLA e alertas | [ ] |
| LIRAa e score territorial | [ ] |
| Notificações push | [ ] |
| Planejamentos | [ ] |

**Avaliação do supervisor:** [ ] Aprovado [ ] Requer reforço

---

### Dias 9–10 — Treinamento dos agentes (2h/agente)
**Responsável:** Suporte técnico + supervisor
**Formato:** Presencial (recomendado) ou vídeo em grupo

Seguir roteiro em `TREINAMENTO_AGENTE.md`

| Agente | Data | Aprovado? | Observações |
|---|---|---|---|
| | | [ ] | |
| | | [ ] | |
| | | [ ] | |
| | | [ ] | |
| | | [ ] | |

---

### Dia 11 — Treinamento dos notificadores (1h)
**Responsável:** Suporte técnico
**Formato:** Vídeo ou presencial

Seguir roteiro em `TREINAMENTO_NOTIFICADOR.md`

| Notificador | Unidade | Aprovado? |
|---|---|---|
| | | [ ] |
| | | [ ] |
| | | [ ] |

---

### Dias 12–14 — Teste operacional supervisionado

| Tarefa | Concluído? |
|---|---|
| Supervisor criou planejamento de vistoria | [ ] |
| 2 agentes executaram vistoria real em 3 imóveis cada | [ ] |
| Supervisor acompanhou em tempo real (`/admin/supervisor-tempo-real`) | [ ] |
| Notificador registrou 1 caso de teste | [ ] |
| Cruzamento foco ↔ caso verificado (banner no foco) | [ ] |
| Denúncia cidadão testada via QR | [ ] |
| Push de notificação recebido pelo supervisor | [ ] |
| Modo offline testado por 1 agente | [ ] |

**Problemas encontrados no teste:**
_______________________________________________

---

## SEMANAS 3–4 — OPERAÇÃO ASSISTIDA (Dias 15–30)

### Rotina diária de suporte (Sentinella)
- [ ] Verificar `/admin/saude-sistema` — erros ou jobs com problema
- [ ] Disponível no WhatsApp das 8h às 17h durante dias de campo
- [ ] Corrigir imóveis com coordenadas incorretas reportados pelos agentes

### Verificações semanais

**Semana 3 (Dias 15–21):**

| Métrica | Meta | Resultado |
|---|---|---|
| Agentes realizando vistorias diariamente | 100% | |
| Taxa de sincronização offline | > 95% | |
| Supervisor abrindo o sistema diariamente | Sim | |
| Problemas críticos (P0) | 0 | |

**Observações da semana 3:**
_______________________________________________

**Semana 4 (Dias 22–30):**

| Métrica | Meta | Resultado |
|---|---|---|
| Vistorias realizadas sem suporte técnico | > 80% | |
| Supervisor usando filtros de foco com autonomia | Sim | |
| Primeiro relatório semanal automático recebido | Sim | |
| Quotas dentro do limite do plano | Sim | |

**Observações da semana 4:**
_______________________________________________

---

## SEMANAS 5–8 — OPERAÇÃO AUTÔNOMA (Dias 31–60)

### Ritmo de suporte
- Semanas 5–6: Check-in 2×/semana (proativo)
- Semanas 7–8: Check-in 1×/semana (somente se necessário)

### Coleta semanal de dados para o relatório final

**Semana 5 (Dias 31–37):**

| KPI | Valor |
|---|---|
| Vistorias realizadas na semana | |
| Focos abertos | |
| Focos resolvidos | |
| SLA médio de atendimento | |
| Denúncias de cidadãos | |
| Imóveis com score crítico (80+) | |

**Semana 6 (Dias 38–44):**

| KPI | Valor |
|---|---|
| Vistorias realizadas na semana | |
| Focos abertos | |
| Focos resolvidos | |
| SLA médio de atendimento | |
| Denúncias de cidadãos | |
| LIRAa do ciclo (IIP municipal) | |

**Semana 7 (Dias 45–51):**

| KPI | Valor |
|---|---|
| Vistorias realizadas na semana | |
| Focos abertos | |
| Focos resolvidos | |
| Agente mais produtivo | |
| Bairro com maior concentração de focos | |

**Semana 8 (Dias 52–60):**

| KPI | Valor |
|---|---|
| Vistorias realizadas na semana | |
| Focos abertos | |
| Focos resolvidos | |
| IIP municipal final | |
| Comparativo com IIP anterior ao piloto | |

---

## MARCOS CRÍTICOS DO PILOTO

| Marco | Data prevista | Concluído? |
|---|---|---|
| Sistema configurado e usuários criados | Dia 7 | [ ] |
| Todos os perfis treinados | Dia 11 | [ ] |
| Primeiro foco registrado em produção | Dia 14 | [ ] |
| Primeira vistoria offline sincronizada | Dia 14 | [ ] |
| Primeiro relatório semanal automático recebido | Dia 21 | [ ] |
| Supervisor opera de forma autônoma | Dia 30 | [ ] |
| Dados suficientes para o relatório de resultados | Dia 50 | [ ] |
| Relatório final apresentado ao secretário | Dia 60 | [ ] |

---

## INCIDENTES E PROBLEMAS

| Data | Descrição | Impacto | Resolução | Tempo |
|---|---|---|---|---|
| | | | | |
| | | | | |

---

## REUNIÃO DE ENCERRAMENTO DO PILOTO (Dia 60)

**Pauta sugerida:**
1. Apresentar relatório de resultados (`MODELO_RELATORIO_RESULTADOS.md`)
2. Revisar os principais marcos atingidos
3. Coletar feedback do secretário e do supervisor
4. Apresentar proposta de contratação
5. Definir próximos passos

**Resultado da reunião de encerramento:**
_______________________________________________

**Decisão da prefeitura:**
[ ] Contratar plano Básico (R$ 890/mês)
[ ] Contratar plano Profissional (R$ 2.490/mês)
[ ] Solicitar proposta Enterprise
[ ] Precisa de mais tempo (follow-up em: ________)
[ ] Não vai contratar (motivo: ________)
