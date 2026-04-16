# PLANO DE SUPORTE — SENTINELLA
**Versão:** 1.0
**Data:** 2026-04-02

---

## 1. VISÃO GERAL

O suporte do Sentinella é estruturado em três camadas:
1. **Autoatendimento** — documentação, vídeos e base de conhecimento
2. **Suporte reativo** — via e-mail ou WhatsApp, conforme o plano
3. **Suporte proativo** — check-ins regulares e monitoramento (Enterprise)

---

## 2. NÍVEIS DE SUPORTE POR PLANO

| Canal | Plano Básico | Plano Profissional | Plano Enterprise |
|---|---|---|---|
| Base de conhecimento | Incluso | Incluso | Incluso |
| E-mail de suporte | Incluso | Incluso | Incluso |
| WhatsApp (horário comercial) | — | Incluso | Incluso |
| WhatsApp prioritário | — | — | Incluso |
| Check-in proativo mensal | — | — | Incluso |
| Gestor de conta dedicado | — | — | Incluso |
| Treinamento presencial anual | — | — | Incluso |

---

## 3. SLA DE RESPOSTA

### Definições de prioridade de incidente

| Prioridade | Descrição | Exemplos |
|---|---|---|
| **P0 — Crítico** | Sistema inacessível ou dados corrompidos | Login não funciona, dados desaparecendo |
| **P1 — Alto** | Funcionalidade principal quebrada | Agente não salva vistoria, foco não cria |
| **P2 — Médio** | Funcionalidade secundária com problema | Relatório PDF com erro de formatação |
| **P3 — Baixo** | Dúvida, sugestão ou melhoria | "Como configurar o LIRAa?" |

### Tempos de resposta por plano

| Prioridade | Plano Básico | Plano Profissional | Plano Enterprise |
|---|---|---|---|
| P0 — Crítico | 12h úteis | 4h úteis | 1h corrida |
| P1 — Alto | 48h úteis | 12h úteis | 4h úteis |
| P2 — Médio | 72h úteis | 48h úteis | 12h úteis |
| P3 — Baixo | 5 dias úteis | 3 dias úteis | 2 dias úteis |

> **Horário comercial:** Segunda a sexta, 8h–18h (horário de Brasília).
> **P0 Enterprise:** Atendimento 24/7 via WhatsApp prioritário.

---

## 4. CANAIS DE SUPORTE

### 4.1 Base de conhecimento (todos os planos)
- Acesso em: `docs.sentinella.com.br` (a implementar)
- Contém: guias de uso por perfil, vídeos de treinamento, FAQs, changelog

### 4.2 E-mail de suporte (todos os planos)
- Endereço: `suporte@sentinella.com.br`
- Ticket criado automaticamente ao enviar e-mail
- Confirmação de recebimento em até 15 minutos (automático)

### 4.3 WhatsApp de suporte (Profissional + Enterprise)
- Número dedicado (não publicar em locais públicos)
- Horário comercial: seg–sex 8h–18h
- Atender com: nome da prefeitura, problema e print de tela se possível

### 4.4 WhatsApp prioritário (Enterprise)
- Canal exclusivo com gestor de conta
- 24/7 para P0
- Resposta em até 1 hora corrida

---

## 5. PROCESSO DE ATENDIMENTO

### Abertura de chamado
1. Cliente envia mensagem pelo canal do plano (e-mail ou WhatsApp)
2. Equipe registra o chamado internamente com prioridade e SLA
3. Confirmação enviada ao cliente com número do chamado e prazo

### Triagem
1. Equipe de suporte valida a prioridade com o cliente
2. Se P0 ou P1: acionar tech lead imediatamente
3. Se P2 ou P3: registrar na fila de atendimento

### Resolução
1. Suporte testa e reproduz o problema em ambiente de staging
2. Fornece solução temporária (workaround) se necessário
3. Registra causa raiz e solução aplicada
4. Comunicar ao cliente com passos para verificar a correção

### Encerramento
1. Cliente confirma que o problema foi resolvido
2. Chamado fechado com documentação da causa e solução
3. Para P0/P1: relatório de incidente enviado ao cliente em 24h

---

## 6. SUPORTE DE IMPLANTAÇÃO (primeiros 30 dias)

Durante a Fase 1 do `METODO_IMPLANTACAO_SENTINELLA.md`, o suporte é intensificado:

| Semana | Nível de assistência |
|---|---|
| Semana 1 | Suporte técnico presente (remoto) nas configurações |
| Semana 2 | Suporte durante os treinamentos (acompanhamento) |
| Semana 3–4 | Disponível via WhatsApp durante horário de campo |

**Esta assistência intensiva está inclusa na taxa de implantação** e não conta como chamados de suporte do plano contratado.

---

## 7. SUPORTE PROATIVO (Enterprise)

### Check-in mensal
- Reunião de 30 min por videoconferência
- Pauta padrão:
  1. Revisão de KPIs do mês (vistorias, focos, SLA médio, LIRAa)
  2. Chamados do período e ações de melhoria
  3. Novidades da plataforma (changelog)
  4. Próximos passos operacionais

### Monitoramento contínuo
- A equipe Sentinella monitora:
  - `sla_erros_criacao` — triggers de SLA com falha
  - `job_queue` — jobs travados ou com erro
  - Quotas de uso mensais
  - Taxa de sincronização offline por cliente

- Se detectado problema crítico: cliente é notificado proativamente antes de reclamar

---

## 8. POLÍTICA DE ATUALIZAÇÕES

### Releases e manutenções
- Releases de funcionalidades: comunicadas com 7 dias de antecedência
- Manutenções programadas: realizadas às terças-feiras 22h–02h (fora do horário de campo)
- Manutenções emergenciais (P0): sem aviso prévio, mas com comunicado em até 15 min

### Compatibilidade de versão
- O sistema é SaaS — todos os clientes usam a mesma versão
- Não há versões customizadas por cliente (exceto Enterprise com SLA de migração customizada)
- Breaking changes: aviso com 30 dias de antecedência

### Changelog
- Disponível na base de conhecimento
- Resumo mensal enviado por e-mail a todos os supervisores

---

## 9. POLÍTICA DE DADOS E BACKUP

### Backup de dados
- Backup automático diário (Supabase)
- Retenção: 30 dias para planos Básico e Profissional; 90 dias para Enterprise
- Restauração: sob solicitação, SLA de 24h úteis

### Exportação de dados
- O cliente pode exportar todos os dados a qualquer momento via `/admin/exportar` (a implementar)
- Formato: CSV + JSON
- Incluso em todos os planos

### Portabilidade
- Em caso de cancelamento: dados exportados e entregues em até 30 dias
- Após 90 dias do cancelamento: dados excluídos permanentemente

---

## 10. ESCALONAMENTO INTERNO

| Nível | Quem atende | Quando acionar |
|---|---|---|
| N1 — Suporte | Atendente de suporte | Dúvidas, erros de uso, P2/P3 |
| N2 — Tech Support | Engenheiro sênior | P1, problemas de dados, integrações |
| N3 — Desenvolvimento | Dev + DBA | P0, bugs críticos, dados corrompidos |

**Regra de escalonamento:** Se N1 não resolver em 2 janelas de resposta, escalar automaticamente para N2.

---

## 11. COMUNICAÇÃO DE INCIDENTES (Status Page)

Página de status em: `status.sentinella.com.br` (a implementar)

Componentes monitorados:
- Aplicação web (frontend)
- API / Supabase
- Edge Functions
- Sincronização offline
- Relatório semanal (cron)
- Integração CNES
- Integração e-SUS Notifica

Comunicação de incidente:
1. Abertura do incidente na status page em até 15 min
2. Atualizações a cada 30 min enquanto ativo
3. Relatório pós-incidente em até 24h para P0
