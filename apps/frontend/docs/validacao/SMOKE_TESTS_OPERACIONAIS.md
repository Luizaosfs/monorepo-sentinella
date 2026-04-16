# Smoke Tests Operacionais — SentinelaWeb

> Versão: P7.12 | Data: 2026-04-14
> Executar antes de cada ciclo de piloto.

---

## Como usar

Execute cada cenário em ordem. Marque ✅ quando passar, ❌ quando falhar.
Falhas críticas (marcadas 🔴) bloqueiam o piloto. Falhas menores (🟡) devem ser documentadas.

---

## BLOCO A — Supervisor / Gestor

### A1 — Acesso e visão geral
| # | Ação | Rota | Resultado esperado | Critério |
|---|---|---|---|---|
| A1.1 | Login com papel `supervisor` | `/login` | Redirecionado para `/gestor/central` ou `/gestor/focos` | 🔴 |
| A1.2 | Ver central operacional | `/gestor/central` | KPIs carregam (focos, SLAs, agentes) | 🔴 |
| A1.3 | Ver lista de focos | `/gestor/focos` | Lista de focos ativos com status e prioridade | 🔴 |
| A1.4 | Acessar triagem | `/gestor/triagem` | Focos em `suspeita` / `em_triagem` aparecem | 🔴 |

### A2 — Atribuição e SLA
| # | Ação | Rota | Resultado esperado | Critério |
|---|---|---|---|---|
| A2.1 | Abrir detalhe de foco | `/gestor/focos/:id` | Histórico, status, responsável visíveis | 🔴 |
| A2.2 | Atribuir agente a foco | Botão "Atribuir" em GestorFocoDetalhe | Responsável salvo; sem erro 500 | 🔴 |
| A2.3 | Ver painel de SLA | `/admin/sla` | Lista de SLAs com status e prazo | 🔴 |
| A2.4 | Atribuir operador a SLA | Dropdown em AdminSla | `api.sla.atribuirOperador()` chamado; SLA vai para `em_atendimento` | 🔴 |
| A2.5 | Identificar SLAs vencidos | Painel SLA | SLAs com prazo expirado aparecem marcados | 🟡 |
| A2.6 | Reabrir SLA concluído | Botão "Reabrir" | Usa `reabrir_sla` RPC; prazo recalculado | 🟡 |

### A3 — Canal cidadão (visão supervisor)
| # | Ação | Rota | Resultado esperado | Critério |
|---|---|---|---|---|
| A3.1 | Acessar canal cidadão | `/admin/canal-cidadao` | Lista de denúncias (até 200) | 🔴 |
| A3.2 | Ver contadores | Tela canal cidadão | Total, Aguardando, Resolvido exibidos | 🟡 |

---

## BLOCO B — Agente de Campo

### B1 — Acesso e Meu Dia
| # | Ação | Rota | Resultado esperado | Critério |
|---|---|---|---|---|
| B1.1 | Login com papel `agente` | `/login` | Redirecionado para `/agente/hoje` | 🔴 |
| B1.2 | Ver "Meu Dia" | `/agente/hoje` | Focos atribuídos ao agente listados | 🔴 |
| B1.3 | Acesso negado a rotas de admin | `/admin/*` ou `/gestor/*` | Redirecionado ou bloqueado | 🔴 |

### B2 — Vistoria e fluxo de foco
| # | Ação | Rota | Resultado esperado | Critério |
|---|---|---|---|---|
| B2.1 | Acessar foco atribuído | `/agente/focos/:id` | Detalhe do foco com histórico | 🔴 |
| B2.2 | Iniciar vistoria em imóvel | `/agente/vistoria/:imovelId` | Formulário de vistoria abre | 🔴 |
| B2.3 | Registrar vistoria completa | Formulário de vistoria | Vistoria salva; foco avança para próximo estado via RPC | 🔴 |
| B2.4 | Concluir fluxo | Botão de conclusão | Estado final registrado em `foco_risco_historico` | 🔴 |
| B2.5 | Ver imóveis da rota | `/agente/imoveis` | Lista de imóveis com estado visível | 🟡 |

### B3 — Offline
| # | Ação | Resultado esperado | Critério |
|---|---|---|---|
| B3.1 | Perder conexão durante vistoria | Operação enfileirada em IndexedDB | 🟡 |
| B3.2 | Reconectar | Fila processada automaticamente; sem duplicata | 🟡 |

---

## BLOCO C — Canal Cidadão (fluxo público)

### C1 — Denúncia básica
| # | Ação | URL | Resultado esperado | Critério |
|---|---|---|---|---|
| C1.1 | Acessar link de denúncia | `/denuncia/:slug/:bairroId` | Formulário público carrega | 🔴 |
| C1.2 | Registrar denúncia válida | Formulário de denúncia | `ok: true`, `foco_id` retornado | 🔴 |
| C1.3 | Conferir protocolo | `/denuncia/consultar` com primeiros 8 chars do foco_id | Status do foco exibido | 🔴 |

### C2 — Rate limit e deduplicação
| # | Ação | Resultado esperado | Critério |
|---|---|---|---|
| C2.1 | Enviar 6+ denúncias do mesmo IP/30min | 6ª retorna `{ ok: false, error: 'Muitas denúncias...' }` | 🔴 |
| C2.2 | Conferir log de bloqueio | `canal_cidadao_rate_log` tem registro `RATE_LIMIT` | 🔴 |
| C2.3 | Enviar denúncia em coordenada já reportada (< 30m, < 24h) | `{ ok: true, deduplicado: true }` com mesmo `foco_id` | 🔴 |
| C2.4 | Conferir log de deduplicação | `canal_cidadao_rate_log` tem registro `DEDUPLICADO` | 🔴 |
| C2.5 | Denúncia sem descrição | `{ ok: false, error: 'Descrição é obrigatória.' }` | 🔴 |

---

## BLOCO D — Segurança e isolamento

### D1 — Isolamento multitenant
| # | Cenário | Resultado esperado | Critério |
|---|---|---|---|
| D1.1 | Agente do cliente A tenta acessar dados do cliente B via query direta | RLS bloqueia; 0 resultados | 🔴 |
| D1.2 | Supervisor do cliente A tenta acessar focos do cliente B | RLS bloqueia | 🔴 |

### D2 — Escalação de privilégio
| # | Cenário | Resultado esperado | Critério |
|---|---|---|---|
| D2.1 | Agente tenta chamar `rpc_transicionar_foco_risco` com foco de outro cliente | RLS bloqueia ou retorna erro | 🔴 |
| D2.2 | Anon tenta chamar RPCs protegidas (ex: `rpc_set_papel_usuario`) | PERMISSION DENIED | 🔴 |
| D2.3 | Canal cidadão tenta inserir diretamente em `focos_risco` | RLS bloqueia (apenas `denunciar_cidadao` tem permissão) | 🔴 |

---

## BLOCO E — Mensagens de erro

| # | Cenário | Resultado esperado | Critério |
|---|---|---|---|
| E1 | Rate limit ativo no canal cidadão | Mensagem legível em português | 🟡 |
| E2 | Transição de status inválida (ex: `resolvido` → `em_triagem`) | Erro claro da RPC, não crash | 🔴 |
| E3 | Papel inválido em `rpc_set_papel_usuario` | `papel_invalido: X não é um papel permitido` | 🟡 |
| E4 | Offline sem fila | Toast informativo ao usuário | 🟡 |

---

## Resultado esperado global

| Critério | Resultado |
|---|---|
| Todos os 🔴 passam | ✅ Sistema apto para piloto |
| Algum 🔴 falha | ❌ Bloqueado — corrigir antes do piloto |
| 🟡 com falha | Registrar como pendência não-bloqueante |
