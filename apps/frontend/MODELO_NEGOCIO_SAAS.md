# MODELO DE NEGÓCIO SAAS — SENTINELLA
**Versão:** 1.0 — pós-auditoria técnica
**Data:** 2026-04-02

---

## 1. POSICIONAMENTO

**O que é:** SaaS multi-tenant para prefeituras brasileiras focado em combate à dengue e vigilância epidemiológica de campo.

**Para quem:** Prefeituras de pequeno, médio e grande porte que precisam organizar e monitorar operações de agentes de controle de endemias.

**Por que diferente:** Único sistema que integra vistoria de campo offline-first, análise por drone com IA, canal cidadão de denúncia, cruzamento automático de casos com focos (PostGIS) e indicadores LIRAa em uma única plataforma.

**Dor resolvida:** Prefeituras usam planilhas, formulários físicos e WhatsApp para gerenciar agentes. Dados não são cruzados. Decisões são tardias. Surtos poderiam ser evitados com antecedência de dias.

---

## 2. PLANOS

### Plano Básico — R$ 890/mês
**Para:** Municípios com até 20.000 imóveis e até 5 agentes de campo.

| Recurso | Limite |
|---|---|
| Agentes de campo | até 5 |
| Imóveis cadastrados | até 20.000 |
| Vistorias por mês | até 2.000 |
| Levantamentos por mês | até 10 |
| Voos de drone | não incluso |
| IA (identificação de larvas) | não incluso |
| Relatórios automáticos | semanal por e-mail |
| Canal cidadão | incluso |
| Integração CNES | incluso |
| Integração e-SUS Notifica | não incluso |
| Suporte | e-mail, resposta em 48h |

---

### Plano Profissional — R$ 2.490/mês
**Para:** Municípios de médio porte com até 80.000 imóveis e até 20 agentes.

| Recurso | Limite |
|---|---|
| Agentes de campo | até 20 |
| Imóveis cadastrados | até 80.000 |
| Vistorias por mês | até 10.000 |
| Levantamentos por mês | até 50 |
| Voos de drone | até 10/mês |
| IA (identificação de larvas) | até 500 chamadas/mês |
| Relatórios automáticos | semanal + diário |
| Canal cidadão | incluso |
| Integração CNES | incluso |
| Integração e-SUS Notifica | incluso |
| Score territorial | incluso |
| LIRAa automatizado | incluso |
| Suporte | WhatsApp + e-mail, resposta em 24h |

---

### Plano Enterprise — sob consulta (a partir de R$ 5.900/mês)
**Para:** Municípios de grande porte, consórcios intermunicipais, secretarias estaduais.

| Recurso | Limite |
|---|---|
| Agentes de campo | ilimitado |
| Imóveis cadastrados | ilimitado |
| Vistorias por mês | ilimitado |
| Levantamentos | ilimitado |
| Voos de drone | ilimitado |
| IA | ilimitado |
| Múltiplos clientes (consórcio) | incluso |
| SLA de suporte dedicado | 4h para P0, 8h para P1 |
| Treinamento presencial | incluso (1x ao ano) |
| Integração personalizada | sob análise |
| Dashboard executivo estadual | incluso |
| Gestor de conta dedicado | incluso |

---

## 3. IMPLANTAÇÃO

| Item | Valor |
|---|---|
| Implantação assistida (remota) | R$ 2.900 (único) |
| Implantação presencial (1 dia) | R$ 4.900 (único) |
| Treinamento adicional por perfil | R$ 490/sessão |
| Migração de dados legados | sob consulta |

> A implantação inclui: configuração do cliente, importação de imóveis, criação de usuários, treinamento remoto e acompanhamento nas primeiras 2 semanas.

---

## 4. MODELO DE COBRANÇA

### Variáveis de precificação consideradas
- **Por município:** modelo mais simples, previsível para a prefeitura
- **Por agente ativo/mês:** cresce com a equipe
- **Por imóvel cadastrado:** reflete o tamanho da operação
- **Por vistoria realizada:** alinha receita ao uso real

### Modelo recomendado para início
**Assinatura mensal por município** com tetos de uso por plano (quotas já implementadas no sistema). Simples de comunicar e cobrar. Upgrade automático ao ultrapassar quotas.

### Expansão futura
- Cobrança por overage (uso acima do plano)
- Add-ons: módulo drone, IA avançada, integração e-SUS produção
- Desconto por volume para consórcios
- Plano anual com 2 meses grátis

---

## 5. SUPORTE

| Canal | Plano | SLA de resposta |
|---|---|---|
| E-mail | Básico | 48h úteis |
| WhatsApp (horário comercial) | Profissional | 24h úteis |
| WhatsApp prioritário + e-mail | Enterprise | 4h (P0), 8h (P1) |

### Categorias de incidente
| Prioridade | Descrição | Exemplo |
|---|---|---|
| P0 — Crítico | Sistema inacessível ou dados corrompidos | Login não funciona, dados sumindo |
| P1 — Alto | Funcionalidade principal quebrada | Agente não consegue salvar vistoria |
| P2 — Médio | Funcionalidade secundária com problema | Relatório PDF com formatação errada |
| P3 — Baixo | Dúvida, melhoria ou sugestão | Como usar o LIRAa |

---

## 6. CUSTO DE AQUISIÇÃO E RECEITA

### Cenário conservador (ano 1)
| Mês | Clientes | MRR estimado |
|---|---|---|
| 1–3 (piloto gratuito) | 1 | R$ 0 |
| 4–6 | 3 | R$ 7.470 |
| 7–9 | 6 | R$ 14.940 |
| 10–12 | 10 | R$ 24.900 |
| **ARR ao fim do ano 1** | | **~R$ 180.000** |

### Cenário moderado (ano 2)
- 30 clientes ativos
- Mix: 60% Básico, 30% Profissional, 10% Enterprise
- MRR: ~R$ 80.000
- ARR: ~R$ 960.000

---

## 7. ESTRATÉGIA DE CRESCIMENTO

### Canal principal: indicação e licitação
- Prefeituras compram por dispensa de licitação (até R$ 57.900/ano em 2024)
- Indicação entre secretarias municipais é o canal mais eficiente
- Presença em eventos de saúde pública (Conasems, Cosems estaduais)

### Piloto gratuito como porta de entrada
- 60 dias gratuitos com suporte assistido
- Prefeitura vê resultado real antes de pagar
- Relatório de piloto entregue ao secretário de saúde

### Ancoragem no custo atual
- Prefeitura hoje gasta com: papel, deslocamento, horas extras de conferência manual
- Sentinella substitui e reduz custo operacional em 30–50%
- Argumento: "custa menos do que 1 agente de campo por mês"

---

## 8. RISCOS E MITIGAÇÕES

| Risco | Impacto | Mitigação |
|---|---|---|
| Prefeitura não tem orçamento | Alto | Buscar emendas parlamentares e programas federais (MS, FUNASA) |
| Rotatividade de agentes | Médio | Onboarding rápido (< 30 min por perfil) |
| Conectividade no campo | Alto | Offline-first já implementado |
| Concorrência de planilha grátis | Médio | Demonstrar valor do cruzamento automático e LIRAa |
| Dependência de Supabase | Médio | Exportação de dados, backup regular |
| LGPD | Baixo | Já implementada (sem dados pessoais em casos_notificados) |

---

## 9. PRÓXIMOS PASSOS COMERCIAIS

- [ ] Montar apresentação executiva de 10 slides (pitch para secretário de saúde)
- [ ] Preparar proposta padrão (PDF) com escopo, valor e cronograma
- [ ] Definir contrato padrão de SaaS (com cláusula LGPD)
- [ ] Criar página de marketing do produto
- [ ] Cadastrar em portal de fornecedores de prefeituras
- [ ] Prospectar 5 municípios piloto via Cosems do estado
- [ ] Estruturar canal de parceiros (revendedores regionais)
