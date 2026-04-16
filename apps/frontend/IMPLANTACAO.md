# IMPLANTAÇÃO — SENTINELLA
Checklist para onboarding de nova prefeitura no sistema Sentinella.

---

## PRÉ-REQUISITOS

Antes de iniciar, confirme:
- [ ] Acesso ao Supabase Dashboard (admin da plataforma)
- [ ] Código IBGE do município (7 dígitos)
- [ ] UF do estado (2 letras)
- [ ] Base de imóveis disponível (CSV ou Excel)
- [ ] Contato do supervisor municipal definido

---

## FASE 1 — CRIAR CLIENTE

**Perfil:** admin de plataforma

1. [ ] Acessar `/admin/clientes` → **Novo cliente**
2. [ ] Preencher: nome da prefeitura, UF, Código IBGE (7 dígitos)
3. [ ] Salvar — seed automático criará:
   - `cliente_quotas` (limites padrão)
   - `sla_config` (regras SLA padrão)
   - `score_config` (pesos de score territorial padrão)
   - `sla_feriados` (feriados nacionais 2025)

---

## FASE 2 — CONFIGURAR REGIÕES E QUARTEIRÕES

**Perfil:** admin ou supervisor

4. [ ] Acessar `/admin/regioes` → cadastrar regiões e bairros do município
5. [ ] Acessar `/admin/distribuicao-quarteirao` → cadastrar quarteirões por região
6. [ ] Configurar ciclo atual em `/admin/ciclos` → **Abrir ciclo**

---

## FASE 3 — SINCRONIZAR UNIDADES DE SAÚDE (CNES)

**Perfil:** admin ou supervisor

7. [ ] Acessar `/admin/unidades-saude`
8. [ ] Verificar se UF e IBGE do cliente estão preenchidos (obrigatório para sync CNES)
9. [ ] Clicar **Sincronizar agora** → aguardar conclusão (pode levar 1–2 min)
10. [ ] Confirmar que as UBSs, UPAs e hospitais do município aparecem na lista

> Se IBGE ou UF não estiverem preenchidos, voltar ao passo 2.

---

## FASE 4 — CRIAR USUÁRIOS

**Perfil:** admin de plataforma (cria supervisor) | supervisor (cria demais)

11. [ ] Acessar `/admin/usuarios` → **Novo usuário**
12. [ ] Criar o supervisor municipal (papel: `supervisor`)
13. [ ] Supervisor loga e cria os agentes de campo (papel: `operador`)
14. [ ] Supervisor cria notificadores das unidades de saúde (papel: `notificador`)

> Cada usuário receberá o OnboardingModal no primeiro login com tour por perfil.

---

## FASE 5 — IMPORTAR IMÓVEIS

**Perfil:** admin ou supervisor

15. [ ] Preparar arquivo CSV/Excel com colunas: `logradouro`, `numero`, `bairro`, `quarteirao`, `latitude`, `longitude`, `tipo_imovel`
16. [ ] Acessar `/admin/importar-imoveis` → fazer upload
17. [ ] Verificar contagem importada e corrigir erros de geocodificação se necessário
18. [ ] Confirmar imóveis em `/admin/imoveis`

---

## FASE 6 — CONFIGURAR RISCO PLUVIAL

**Perfil:** admin ou supervisor

19. [ ] Acessar `/admin/risk-policy` → revisar limites de chuva/temperatura/vento para o clima local
20. [ ] Acessar `/admin/pluvio-risco` → confirmar que dados climáticos estão sendo carregados
   - A Edge Function `pluvio-risco-daily` roda automaticamente todo dia via cron

---

## FASE 7 — CONFIGURAR SLA E FERIADOS

**Perfil:** supervisor

21. [ ] Acessar `/admin/sla-feriados` → verificar feriados municipais e adicionar os locais
22. [ ] Acessar `/admin/sla` → confirmar configuração de SLA por prioridade

---

## FASE 8 — CONFIGURAR CANAL CIDADÃO

**Perfil:** supervisor

23. [ ] Acessar `/admin/canal-cidadao`
24. [ ] Gerar QR code do canal público
25. [ ] Distribuir o link `/denuncia/:slug/:bairroId` nos canais de comunicação da prefeitura

---

## FASE 9 — TESTE OPERACIONAL

Executar 1 ciclo completo de ponta a ponta:

26. [ ] **Supervisor:** criar planejamento de vistoria manual em `/admin/planejamentos`
27. [ ] **Agente:** fazer login → Meu Dia → selecionar imóvel → executar vistoria completa (5 etapas)
28. [ ] **Agente:** testar modo offline (desligar wi-fi, fazer vistoria, religar e confirmar sincronização)
29. [ ] **Notificador:** registrar caso suspeito em `/notificador/registrar`
30. [ ] **Supervisor:** confirmar cruzamento foco ↔ caso em `/gestor/focos`
31. [ ] **Cidadão:** testar denúncia pública via QR → confirmar protocolo gerado
32. [ ] **Supervisor:** transicionar foco: suspeita → triagem → confirmado → resolvido

---

## FASE 10 — VALIDAR RELATÓRIOS E NOTIFICAÇÕES

33. [ ] Confirmar recebimento de push de SLA crítico (supervisor)
34. [ ] Confirmar recebimento de e-mail de relatório semanal (Edge Function `relatorio-semanal`)
35. [ ] Gerar exportação LIRAa em `/admin/liraa` → verificar PDF
36. [ ] Verificar painel executivo em `/admin/executivo`

---

## PÓS-IMPLANTAÇÃO

**Monitoramento contínuo:**
- `/admin/saude-sistema` — saúde da plataforma (acesso apenas admin)
- `/admin/job-queue` — fila de jobs (acesso apenas admin)
- `/admin/supervisor-tempo-real` — agentes em campo ao vivo (supervisor)
- `/gestor/central` — Central do Dia do supervisor

**Quotas e billing:**
- Revisar limites em `/admin/quotas` conforme uso real
- Snapshot de billing gerado automaticamente no 1º de cada mês

---

## CONTATOS E SUPORTE

| Situação | Ação |
|---|---|
| Falha de sincronização CNES | Verificar `/admin/job-queue` e logs da Edge Function `cnes-sync` |
| Agente não consegue sincronizar offline | Verificar fila IndexedDB no DevTools → Application → IndexedDB |
| Foco não criado após denúncia | Verificar rate limit (5/min) e RPC `denunciar_cidadao` nos logs |
| SLA não marcado como vencido | Edge Function `sla-marcar-vencidos` roda a cada 15min — aguardar ou verificar logs |
| Score territorial desatualizado | Acionar `api.score.forcarRecalculo` ou aguardar cron (07h UTC diário) |
