# Checklist Final Pré-Piloto — SentinelaWeb

> Versão: P7.12 | Data: 2026-04-14
> Execute este checklist antes de autorizar o piloto com o cliente real.
> Referência de execução: `docs/validacao/SMOKE_TESTS_OPERACIONAIS.md`

---

## 1. Banco de dados / Migrations

| # | Item | Status |
|---|---|---|
| DB-01 | Todas as migrations até `20270229` aplicadas no ambiente alvo | ☐ |
| DB-02 | `canal_cidadao_rate_log` existe e RLS ativa (admin vê tudo; supervisor vê só seu cliente) | ☐ |
| DB-03 | `v_canal_cidadao_eventos_audit` existe e retorna dados agregados | ☐ |
| DB-04 | `v_canal_cidadao_stats` existe e retorna contadores por cliente | ☐ |
| DB-05 | `rpc_set_papel_usuario` existe e rejeita papéis fora da lista canônica | ☐ |
| DB-06 | `denunciar_cidadao` atualizado: registra RATE_LIMIT, DEDUPLICADO, ACEITO em `canal_cidadao_rate_log` | ☐ |
| DB-07 | `canal_cidadao_rate_limit` existe e limita a 5 denúncias por IP / 30min | ☐ |
| DB-08 | `rpc_transicionar_foco_risco` rejeita transições inválidas com erro legível | ☐ |
| DB-09 | Trigger `fn_iniciar_sla_ao_confirmar_foco` ativa SLA ao confirmar foco | ☐ |
| DB-10 | `sla_config` populado para o cliente piloto (pelo menos P3=24h) | ☐ |

---

## 2. Segurança / RLS / Multitenancy

| # | Item | Status |
|---|---|---|
| SEC-01 | `focos_risco` usa policy `focos_risco_select` com `usuario_pode_acessar_cliente()` | ☐ |
| SEC-02 | `sla_operacional` com RLS ativa; agente não acessa SLA de outro cliente | ☐ |
| SEC-03 | `papeis_usuarios` — INSERT/DELETE apenas via `rpc_set_papel_usuario`; anon bloqueado | ☐ |
| SEC-04 | `canal_cidadao_rate_log` — INSERT apenas via service_role; anon sem acesso | ☐ |
| SEC-05 | `foco_risco_historico` — INSERT revogado de `authenticated`; apenas triggers/service_role | ☐ |
| SEC-06 | Agente do cliente A não vê focos do cliente B (testar via query direta) | ☐ |
| SEC-07 | `platform_admin` não existe em nenhum usuário (SELECT de papeis_usuarios WHERE papel='platform_admin') | ☐ |
| SEC-08 | `denunciar_cidadao` acessível por `anon` (sem JWT) e retorna `foco_id` | ☐ |

---

## 3. Fluxo Supervisor / Gestor

| # | Item | Status |
|---|---|---|
| SUP-01 | Login `supervisor` → redireciona para `/gestor/central` ou `/gestor/focos` | ☐ |
| SUP-02 | KPIs da CentralOperacional carregam (focos, SLAs, agentes) | ☐ |
| SUP-03 | Lista de focos exibe status e prioridade corretamente | ☐ |
| SUP-04 | Triagem territorial disponível em `/gestor/triagem` | ☐ |
| SUP-05 | Atribuição de agente a foco funciona (sem erro 500) | ☐ |
| SUP-06 | Painel SLA lista SLAs com prazo e status | ☐ |
| SUP-07 | Dropdown de atribuição de operador chama `api.sla.atribuirOperador()` | ☐ |
| SUP-08 | SLAs vencidos marcados visualmente | ☐ |
| SUP-09 | Canal cidadão admin mostra até 200 denúncias | ☐ |
| SUP-10 | Contadores do canal cidadão (total / aguardando / resolvido) exibidos | ☐ |

---

## 4. Fluxo Agente de Campo

| # | Item | Status |
|---|---|---|
| AGE-01 | Login `agente` → redireciona para `/agente/hoje` | ☐ |
| AGE-02 | "Meu Dia" lista focos atribuídos ao agente logado | ☐ |
| AGE-03 | Agente bloqueado em `/admin/*` e `/gestor/*` | ☐ |
| AGE-04 | Detalhe de foco atribuído abre com histórico | ☐ |
| AGE-05 | Formulário de vistoria abre em `/agente/vistoria/:imovelId` | ☐ |
| AGE-06 | Vistoria salva e foco avança de estado via RPC | ☐ |
| AGE-07 | Estado final registrado em `foco_risco_historico` | ☐ |
| AGE-08 | FichaImovel360 exibe status do imóvel corretamente | ☐ |

---

## 5. Canal Cidadão (fluxo público)

| # | Item | Status |
|---|---|---|
| CID-01 | `/denuncia/:slug/:bairroId` abre sem autenticação | ☐ |
| CID-02 | Denúncia válida retorna `{ ok: true, foco_id, deduplicado: false }` | ☐ |
| CID-03 | Protocolo gerado = primeiros 8 chars do `foco_id` | ☐ |
| CID-04 | `/denuncia/consultar` exibe status do foco pelo protocolo | ☐ |
| CID-05 | 6ª denúncia do mesmo IP/30min retorna `{ ok: false, error: 'Muitas denúncias...' }` | ☐ |
| CID-06 | Bloqueio registrado em `canal_cidadao_rate_log` com `motivo='RATE_LIMIT'` | ☐ |
| CID-07 | Denúncia em coordenada já reportada (< 30m / < 24h) retorna `{ ok: true, deduplicado: true }` | ☐ |
| CID-08 | Deduplicação registrada em `canal_cidadao_rate_log` com `motivo='DEDUPLICADO'` | ☐ |
| CID-09 | Denúncia sem descrição retorna `{ ok: false, error: 'Descrição é obrigatória.' }` | ☐ |

---

## 6. Mensagens de erro e experiência

| # | Item | Status |
|---|---|---|
| ERR-01 | Rate limit do canal cidadão exibe mensagem em português (não stack trace) | ☐ |
| ERR-02 | Transição de status inválida retorna erro claro da RPC — sem crash no frontend | ☐ |
| ERR-03 | Papel inválido em `rpc_set_papel_usuario` retorna `papel_invalido: X não é um papel permitido` | ☐ |
| ERR-04 | Offline: toast informativo ao usuário quando sem fila configurada | ☐ |
| ERR-05 | Erro de atribuição de SLA exibe mensagem amigável (não expõe SQL) | ☐ |

---

## 7. Observabilidade (pós-piloto)

| # | Item | Status |
|---|---|---|
| OBS-01 | `v_canal_cidadao_eventos_audit` consultável por supervisor via `api.canalCidadao.eventosAudit()` | ☐ |
| OBS-02 | `v_canal_cidadao_stats` consultável por admin via `api.canalCidadao.stats()` | ☐ |
| OBS-03 | `piloto_eventos` registrando eventos de uso via `logEvento()` | ☐ |
| OBS-04 | `foco_risco_historico` append-only com todas as transições registradas | ☐ |

---

## Resultado esperado

| Critério | Para prosseguir |
|---|---|
| Todos os itens 🔴 críticos do smoke test passam | ✅ Obrigatório |
| DB-01 a DB-10 todos ✅ | ✅ Obrigatório |
| SEC-01 a SEC-08 todos ✅ | ✅ Obrigatório |
| Itens 🟡 não-bloqueantes registrados como pendências | ☐ Documentar |

> **Não iniciar piloto com qualquer item obrigatório ❌.**
> Registrar resultado final em `docs/auditoria/P7_12_RESULTADO_PILOTO.md` após execução.
