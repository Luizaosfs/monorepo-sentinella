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

## Próxima rodada
Migração de `req['tenantId']` → AccessScope (Prompt C). Começa pelo
módulo `operacao` (18 arquivos). Não bloqueada por nenhuma pendência
acima.
