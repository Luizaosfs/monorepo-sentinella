# Pendências de hardening — pós-fix IDOR (29/04/2026)

## Origem
Após auditoria B-04 e fechamento de 2 IDORs cross-tenant
(commits 1f060bd e f078496), ficaram 5 itens em aberto.

## Itens

### 1. E2E suite quebrada por auth de banco
- Sintoma: `pnpm jest --testPathPattern vistoria` inclui specs em
  `test/e2e/` que falham com "Authentication failed against the database
  server, the provided database credentials for `test` are not valid".
- Origem: `.env.test` ou setup do banco de teste local.
- Risco: camada de validação E2E não exerce em ambiente local. Fixes
  passaram apenas em unit.
- Prioridade: Média.

### 2. .claude/settings.local.json rastreado pelo git
- Sintoma: arquivo aparece em `git status` como modificado a cada sessão.
- Risco: poluição do repo com config local + commit acidental de chaves
  de API se houver.
- Ação: adicionar `.claude/settings.local.json` ao .gitignore + rodar
  `git rm --cached .claude/settings.local.json` em commit dedicado.
- Prioridade: Média.

### 3. delete-voo.ts e save-voo.ts carregam todos os voos via findVoos
- Sintoma: detectado durante análise do P0; não tratado por estar fora
  de escopo.
- Risco: performance + semântica (carregam N voos quando precisam de 1).
- Ação: investigar se findVoos é o método certo; provavelmente deveria
  ser findVooById.
- Prioridade: Baixa.

### 4. Outros métodos sem `where cliente_id` que B-04 não pegou
- Sintoma: o grep de B-04 caçou métodos com assinatura suspeita
  (`clienteId?: string | null`). Métodos como findVoos (com
  `_clienteId: string`) só apareceram porque o Passo 4 de B-04 pediu
  inspeção explícita.
- Risco: pode haver outros métodos parecidos em outros repos.
- Ação: rodar B-bis — auditar TODOS os métodos de TODOS os repos
  prisma em shared/modules/database/ por presença de `where:` com
  filtro de cliente_id (direto ou relacional).
- Prioridade: Alta (pode haver outros IDORs latentes).

### 5. Cobertura legada do prisma-vistoria-read.repository.spec.ts
- Sintoma: 6 testes legados agora chamam findByIdComDetalhes(id, null),
  o que desliga o filtro de tenant nesses testes.
- Risco: cobertura de regressão de filtro de tenant fica concentrada no
  spec novo (findByIdComDetalhes.spec.ts).
- Ação: revisar se algum dos 6 deveria ter sido convertido pra usar
  tenant não-nulo.
- Prioridade: Baixa.

### 6. Validação cross-tenant em IDs de body de operacao
- Sintoma: 7 campos (focoRiscoId, responsavelId, itemLevantamentoId,
  itemOperacionalId, regiaoId, id, itemId) recebidos em body de
  endpoints de operacao não são validados contra o tenant do usuário.
- Risco: usuário com ?clienteId X pode passar agenteId/focoId/regiaoId
  de cliente Y; chave estrangeira aceita; INSERT/UPDATE pode ocorrer
  com IDs cross-tenant.
- Ação: adicionar requireClientePermitido(scope, entity.cliente_id)
  após findById de cada entidade referenciada por ID de body.
- Prioridade: Alta — é o padrão B-02 da auditoria original.

### 7. Padrão clienteIds[0] do operacao não é portável para módulos com analista_regional
- Sintoma: 4 use-cases do operacao (filter, pagination, stats,
  listar-com-vinculos) usam `clienteIds !== null ? clienteIds[0] : undefined`
  em vez de `{ in: clienteIds }`.
- Por que funciona em operacao: nenhum endpoint inclui analista_regional;
  clienteIdsPermitidos é sempre null ou [único].
- Risco: ao copiar esse padrão para módulos com analista_regional
  (clienteIdsPermitidos pode ter >1 elemento), clienteIds[0] descarta
  todos os clientes do agrupamento exceto o primeiro — bug silencioso.
- Ação imediata: nos próximos módulos (sla, dashboard, levantamento,
  vistoria...), verificar PRIMEIRO se algum endpoint inclui
  analista_regional. Se sim, usar `{ in: clienteIds }` (Prisma) ou
  `ANY(...)` (raw SQL), não clienteIds[0].
- Ação futura (módulo operacao): se algum dia operacao receber
  analista_regional, refatorar os 4 use-cases para o padrão `{ in: ... }`.
- Prioridade: Alta — risco de regressão silenciosa em módulos futuros.

## Próxima rodada
Migração de `req['tenantId']` → AccessScope (Prompt C). Módulo `operacao`
concluído (commits ae7259c–ec80b89, 29/04/2026, baseline 1072 testes).
Próximo: módulo `sla` (15 arquivos com req['tenantId']).
