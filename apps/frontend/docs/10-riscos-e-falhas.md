# 10 — Riscos e Falhas

## Objetivo deste documento

Identificar e analisar riscos de segurança, operacionais, de regressão, de dados e de escalabilidade no sistema Sentinella Web.

> **Para quem é este documento:** responsáveis técnicos pela segurança e estabilidade, gestores que precisam tomar decisões de priorização, e desenvolvedores que estão introduzindo novas funcionalidades em módulos de risco.

> **Convenção de leitura:**
> - `[OBSERVADO]` — verificado diretamente no código
> - `[INFERIDO]` — deduzido a partir de evidências indiretas
> - Severidade: **CRÍTICA / ALTA / MÉDIA / BAIXA**
> - Probabilidade: **Alta / Média / Baixa**

> **Importante:** este documento registra riscos identificados em análise estática. Não há garantia de que todos os problemas ainda existam ou de que não existam problemas adicionais. A auditoria de um sistema de saúde pública deve incluir testes dinâmicos e pentest especializado.

---

## Resumo executivo

| Categoria | Crítico | Alto | Médio | Baixo |
|-----------|---------|------|-------|-------|
| Segurança | 2 | 3 | 2 | 1 |
| Dados | 1 | 2 | 1 | 0 |
| Operacional | 0 | 2 | 2 | 1 |
| Regressão | 1 | 1 | 1 | 0 |
| Escalabilidade | 0 | 1 | 1 | 1 |

Os dois riscos críticos são: (1) pipeline Python com possível acesso irrestrito via `service_role` key e (2) ausência de testes automatizados em um sistema de saúde pública. Ambos têm potencial de impacto irreversível.

---

## Riscos de Segurança

### RS-01 — Pipeline Python: Acesso Potencialmente Irrestrito ao Banco

**Severidade:** CRÍTICA
**Probabilidade:** Média
**Status:** Não verificado — auditoria urgente necessária

#### Descrição
O pipeline Python (módulo Sentinella para processamento de voos e YOLO) precisa gravar dados no banco Supabase. Não está documentado se usa a `anon key` (sujeita a RLS) ou a `service_role key` (bypassa RLS completamente). `[INFERIDO]` a partir da ausência de documentação e do padrão das Edge Functions, que todas usam `service_role`.

#### Por que é crítico
- Se o pipeline usa `service_role key`, tem acesso irrestrito a dados de **todas as prefeituras**
- Um bug no filtro de `cliente_id` no pipeline retornaria ou gravaria dados de uma prefeitura em outra
- Não há registro de auditoria de quais dados o pipeline acessou ou modificou
- O pipeline opera fora do controle do frontend e do RLS

#### Evidência indireta
Todas as Edge Functions do sistema usam `service_role key`. `[OBSERVADO]` em `supabase/functions/*/index.ts`. O pipeline Python provavelmente segue o mesmo padrão por necessidade operacional (precisa inserir dados em tabelas protegidas por RLS).

#### Ação corretiva
1. **Imediato:** auditar o código Python e verificar qual key é usada
2. Se usar `service_role`: revisar todos os filtros de `cliente_id` no pipeline
3. Considerar criar uma `service_role` com permissões limitadas a apenas as tabelas necessárias (Supabase não suporta isso nativamente — considerar uma Edge Function intermediária)
4. Adicionar logging de auditoria nas operações de escrita do pipeline

---

### RS-02 — Canal Cidadão sem Rate Limiting

**Severidade:** ALTA
**Probabilidade:** Alta
**Status:** Confirmado — ausência de código de rate limiting

#### Descrição
A RPC `canal_cidadao_denunciar` é a única função que permite escrita no banco **sem autenticação**. Qualquer pessoa com o slug da prefeitura pode fazer quantas denúncias quiser. Não há rate limiting implementado. `[OBSERVADO]` na ausência de código de controle de frequência na RPC e na página `DenunciaCidadao.tsx`.

#### Impacto
- Um atacante com o slug pode fazer flood de milhares de denúncias falsas em segundos
- O banco de dados seria preenchido com registros inválidos
- Operadores perderiam tempo investigando denúncias falsas
- A prefeitura poderia atingir limites de quota do Supabase
- O sistema de alertas (SLA, cruzamentos) poderia ser sobrecarregado por dados falsos

#### O slug como única proteção
O slug é obtido via QR code físico afixado em locais públicos. Em teoria, é "semissecreto". Na prática, qualquer pessoa que fotografar o QR code tem o slug. Uma vez publicado, é irrevogável sem mudar todos os QR codes impressos.

#### Ação corretiva
1. **Curto prazo:** implementar rate limiting por IP na Edge Function ou via Supabase (usar tabela de controle com timestamp + IP hash)
2. Adicionar CAPTCHA simples na página pública
3. Considerar validação de honeypot (campo oculto que bots preenchem)

---

### RS-03 — Tabelas sem RLS Confirmado

**Severidade:** ~~ALTA~~ → **BAIXO** (pós-correção)
**Probabilidade:** ~~Média~~ → Resolvido
**Status:** ✅ **Auditoria concluída em 2026-07-12 — única lacuna corrigida**

#### Resultado da auditoria

Auditoria completa das migrations revelou que as tabelas originalmente sinalizadas como suspeitas **todas têm RLS correto**. A única tabela sem RLS encontrada foi `notificacao_protocolo_seq`, corrigida pela migration `20260712010000`.

| Tabela | Status anterior | Status atual |
|--------|----------------|--------------|
| `yolo_feedback` | Não confirmado | ✅ RLS confirmado (`20250317002000`) |
| `levantamento_analise_ia` | Não confirmado | ✅ RLS confirmado (`20250317002000`) |
| `unidades_saude_sync_controle` | Não confirmado | ✅ RLS confirmado (`20250319000000`) |
| `unidades_saude_sync_log` | Não confirmado | ✅ RLS confirmado (`20250319000000`) |
| `cliente_integracoes` | Não confirmado | ✅ RLS confirmado (`20250318003000`) |
| `notificacao_protocolo_seq` | Não verificado | ✅ **RLS habilitado em `20260712010000`** |

#### Sobre a correção de `notificacao_protocolo_seq`

Tabela de contadores sequenciais de protocolo por prefeitura/mês. Acessada exclusivamente pela função `proximo_protocolo_notificacao()` (SECURITY DEFINER). Foi habilitado RLS **sem políticas adicionais** — o acesso direto por usuários autenticados é bloqueado pelo *deny all* padrão do PostgreSQL, enquanto a função continua operando normalmente por ser SECURITY DEFINER.

#### Anomalia residual documentada (sem correção necessária)

`levantamento_item_detecoes` (`20260608100000`): tem RLS habilitado, mas a política de INSERT usa `levantamentos.usuario_id` em vez de `levantamentos.cliente_id`. Inconsistente com o padrão do projeto, mas sem impacto prático — a tabela é gravada pelo pipeline Python via `service_role key`. Documentado para revisão futura.

#### Verificação no banco de produção
```sql
-- spatial_ref_sys é excluída: extensão PostGIS, dados públicos, sem risco.
-- Deve retornar zero linhas após aplicação de 20260712010000
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename NOT IN ('spatial_ref_sys')
ORDER BY tablename;
```

#### Ação corretiva
Executar a query acima no banco real. Se `rowsecurity = false` para alguma tabela, criar migration corretiva imediatamente com `ENABLE ROW LEVEL SECURITY` e políticas de isolamento por `cliente_id`.

---

### RS-04 — Edge Functions com `service_role key` sem Auditoria

**Severidade:** ALTA
**Probabilidade:** Baixa (risco latente)
**Status:** Confirmado — padrão observado em todas as Edge Functions

#### Descrição
Todas as 12 Edge Functions identificadas usam a `service_role key` para acessar o banco, o que bypassa completamente o RLS. `[OBSERVADO]` em múltiplos arquivos `supabase/functions/*/index.ts`.

#### Por que é risco
- Um bug em qualquer Edge Function que errar o filtro de `cliente_id` retorna dados de todas as prefeituras
- Não há registro de auditoria central de quais prefeituras foram acessadas por qual Edge Function
- Edge Functions são executadas por triggers (CNES sync, relatório semanal) sem interação humana — um bug silencioso pode vazar dados por semanas

#### Edge Functions com acesso a dados mais sensíveis
| Função | Dados acessados | Risco específico |
|--------|-----------------|-----------------|
| `relatorio-semanal` | Todos os levantamentos do cliente | Se filtro errar, envia relatório de cliente A para cliente B |
| `sla-push-critico` | SLA + subscrições Web Push | Push notification para dispositivo errado |
| `triagem-ia-pos-voo` | Imagens + itens de levantamento | Análise IA com dados misturados |
| `cnes-sync` | Unidades de saúde de todos os clientes | Menor risco — dados públicos do CNES |

#### Ação corretiva
Revisar cada Edge Function e garantir que o filtro de `cliente_id` está presente em todas as queries de leitura e escrita. Considerar adicionar logging de auditoria.

---

### RS-05 — Supervisor Pode Acessar Página de Listagem de Prefeituras

**Severidade:** MÉDIA
**Probabilidade:** Baixa
**Status:** Confirmado — ausência de guard específico

#### Descrição
A rota `/admin/clientes` (listagem de todas as prefeituras cadastradas na plataforma) é protegida pelo `AdminOrSupervisorGuard`, mas conceitualmente deveria ser acessível apenas a usuários com papel `admin` (administrador da plataforma). Um `supervisor` de prefeitura que navegar diretamente para essa URL verá a página. `[OBSERVADO]` em `src/guards/AdminOrSupervisorGuard.tsx` e na ausência de um `AdminOnlyGuard`.

#### Mitigação existente
O banco de dados retornará apenas os dados da própria prefeitura do supervisor, então ele não verá dados de outras prefeituras. O risco é de experiência confusa e de futuras queries que eventualmente esqueçam o filtro de `cliente_id`.

#### Ação corretiva
Criar um `AdminOnlyGuard` e aplicar nas rotas que são exclusivas do administrador de plataforma.

---

### RS-06 — Funções SECURITY DEFINER sem Auditoria Periódica

**Severidade:** MÉDIA
**Probabilidade:** Baixa (risco latente)
**Status:** Confirmado — 9+ funções identificadas

#### Descrição
Funções `SECURITY DEFINER` executam com os privilégios do criador (geralmente superuser). Um bug nessas funções opera com privilégios elevados. Foram identificadas 9 funções com essa característica. `[OBSERVADO]` em `06-rls-e-seguranca.md`.

#### Função de maior risco
`canal_cidadao_denunciar` — é SECURITY DEFINER **e** aceita entrada sem autenticação. Qualquer vulnerabilidade de SQL injection aqui opera como superuser.

#### Ação corretiva
Auditoria de SQL injection em todas as funções SECURITY DEFINER, especialmente `canal_cidadao_denunciar`. Garantir que todos os parâmetros de entrada são tipados e que não há concatenação de strings SQL.

---

## Riscos de Dados

### RD-01 — ~~Perda de Dados de Cruzamento em Surtos~~ — RESOLVIDO HISTORICAMENTE

**Severidade:** ~~ALTA~~ BAIXA (histórico)
**Probabilidade:** ~~Alta em surtos~~ Inexistente
**Status:** ✅ Resolvido — sem risco ativo

#### Descrição original
O trigger `fn_cruzar_caso_com_focos` (migration `20250318000000`) usava `jsonb_set` para gravar um único `caso_id` no `payload` de `levantamento_itens`, sobrescrevendo a cada execução. Em um surto com múltiplos casos no mesmo raio de 300m, apenas o último caso ficava registrado no campo.

#### Por que o risco não existe mais
Diagnóstico realizado em 2026-07-12 (QW-03) revelou que o bug foi corrigido antes de causar impacto observável:

1. **Migration `20260604000000` (R-38):** trigger corrigido para acumular em array (`casos_notificados_proximidade`)
2. **Migration `20260710020000`:** `payload` limpo de todas as chaves de caso (`caso_notificado_proximidade`, `casos_notificados_proximidade`)
3. **Migration `20260710030000`:** relação caso↔foco migrada para `focos_risco.casos_ids` — o `payload` não é mais usado para isso
4. **Frontend:** `ItemCasosNotificados.tsx` e `api.casosNotificados` sempre consultaram `caso_foco_cruzamento` via RPC — nunca leram campos de payload

#### Estado atual
- `levantamento_itens.payload` não contém chaves de caso (confirmado na migration de cleanup)
- Fonte canônica: `focos_risco.casos_ids` (UUID[]) + tabela `caso_foco_cruzamento`
- Nenhuma ação necessária

---

### RD-02 — Usuário de Desenvolvimento Possivelmente em Produção

**Severidade:** ALTA
**Probabilidade:** Média
**Status:** Não verificado — auditoria necessária

#### Descrição
A migration `20250306160000_seed_operador_luiz.sql` insere um usuário de desenvolvimento no banco. Se esta migration foi aplicada ao banco de produção (o comportamento padrão quando não há separação de ambientes), este usuário existe lá. `[OBSERVADO]` pelo nome do arquivo.

#### Impacto
- Violação de LGPD se o usuário acessar dados reais de prefeituras
- Credenciais potencialmente fracas ou compartilhadas pela equipe de desenvolvimento
- O Supabase Auth não distingue automaticamente ambientes — a migration cria o usuário onde for executada

#### Ação corretiva
```sql
-- Verificar no banco de produção:
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE email ILIKE '%luiz%' OR email ILIKE '%dev%' OR email ILIKE '%test%';
```

Se encontrado: desativar ou remover o usuário e criar migration de limpeza.

---

### RD-03 — Dados de Geolocalização do Agente em `vistorias`

**Severidade:** MÉDIA
**Probabilidade:** Baixa
**Status:** Observado — não é PII de cidadão, mas é dado sensível operacional

#### Descrição
A tabela `vistorias` armazena `lat_chegada` e `lng_chegada` — a localização GPS do agente de saúde no momento do checkin. Combinado com `agente_id` e `imovel_id`, é possível reconstruir o trajeto completo de um agente ao longo do dia. `[OBSERVADO]` no schema da tabela.

#### Contexto
Não é PII de cidadão (sem implicações diretas de LGPD para usuários). É dado operacional sobre funcionários públicos. Dependendo da interpretação jurídica, pode ser considerado dado pessoal do agente.

#### Ação corretiva
Verificar com a equipe jurídica se a retenção indefinida de localização de agentes requer política de retenção de dados. Considerar anonimizar ou agregar após encerramento do ciclo.

---

## Riscos Operacionais

### RO-01 — Sem Visibilidade do Status do Pipeline Python

**Severidade:** ALTA
**Probabilidade:** Alta (ocorre hoje)
**Status:** Observado — ausência de interface de monitoramento

#### Descrição
O pipeline Python (processamento de voos, YOLO, extração de metadados) opera fora do sistema web. Não há uma página ou indicador no sistema que mostre: se um voo está sendo processado, se o processamento falhou, qual foi o erro, quantas imagens foram processadas ou rejeitadas. `[OBSERVADO]` pela ausência de componentes ou APIs de monitoramento de pipeline no codebase.

#### Impacto operacional
- Um voo que falha silenciosamente no processamento não gera levantamento_itens
- O operador espera itens que nunca chegam, sem saber o motivo
- A prefeitura acredita que o drone "não encontrou nada" quando na verdade o processamento falhou
- Suporte precisa verificar logs Python manualmente — demora horas

#### Ação corretiva
Criar tabela de status de processamento de voo (`pipeline_runs`) com campos de status, erros, progresso, e um painel simples no admin que exiba o estado atual.

---

### RO-02 — Web Push Não Funciona em iOS Safari

**Severidade:** ALTA**
**Probabilidade:** Alta (plataforma não suportada)
**Status:** Limitação técnica conhecida do sistema

#### Descrição
O sistema implementa Web Push para alertas de SLA crítico via `src/lib/webPush.ts` e a Edge Function `sla-push-critico`. Web Push em iOS Safari só é suportado a partir do iOS 16.4 com o app adicionado à tela inicial (PWA mode). `[INFERIDO]` — esta é uma limitação bem conhecida do ecossistema Web Push.

#### Impacto
Agentes de campo que usam iPhone (iOS < 16.4 ou sem instalar como PWA) não recebem alertas de SLA crítico. A funcionalidade existe e foi implementada, mas silenciosamente não funciona para uma parte significativa dos usuários de campo.

#### Ação corretiva
1. Exibir mensagem de aviso quando o navegador não suportar Web Push
2. Implementar fallback: mostrar badge de contagem no app em vez de push notification
3. Documentar no manual do operador que iOS requer instalação como PWA

---

### RO-03 — CNES Sync sem Tratamento de Conflito de Dados Manuais

**Severidade:** MÉDIA
**Probabilidade:** Média
**Status:** Observado na lógica da Edge Function

#### Descrição
A Edge Function `cnes-sync` sincroniza unidades de saúde do DATASUS. A regra implementada é: unidades com `origem='manual'` e `cnes IS NULL` nunca são inativadas pela sync. Mas unidades com `origem='manual'` que têm um `cnes` cadastrado manualmente podem ser sobrescritas pela sync se o CNES for encontrado na base do DATASUS. `[INFERIDO]` a partir da lógica de upsert da Edge Function.

#### Impacto
Uma prefeitura que cadastrou manualmente um posto de saúde com informações específicas (horário de funcionamento, contato local) pode ter esses dados sobrescritos pela versão genérica do DATASUS após a próxima sync automática.

#### Ação corretiva
Implementar merge inteligente: dados locais têm precedência sobre dados do DATASUS em campos como `nome_fantasia`, `telefone`, `observacao`. Dados do DATASUS têm precedência apenas em campos que o sistema local não preenche.

---

### RO-04 — Relatório Semanal sem Confirmação de Entrega

**Severidade:** BAIXA
**Probabilidade:** Média
**Status:** Observado na Edge Function

#### Descrição
A Edge Function `relatorio-semanal` envia e-mail via Resend API toda segunda às 8h UTC. Não há registro de sucesso/falha de entrega no banco, nem reenvio automático em caso de erro. `[OBSERVADO]` em `supabase/functions/relatorio-semanal/index.ts`.

#### Impacto
Gestores municipais podem não receber o relatório semanal sem saber. Isso pode afetar a percepção de valor do sistema.

#### Ação corretiva
Adicionar tabela de log de envios de relatório com status de entrega. Implementar reenvio manual via admin.

---

## Riscos de Regressão

### RR-01 — Ausência de Testes em Sistema de Saúde Pública

**Severidade:** CRÍTICA
**Probabilidade:** Alta (regra estatística)
**Status:** Confirmado — sem nenhum arquivo de teste

#### Descrição
Sistema sem testes automatizados em qualquer nível (unitário, integração, end-to-end). Qualquer mudança pode quebrar qualquer coisa, e ninguém saberá até que alguém relate um problema em campo. `[OBSERVADO]` pela ausência de arquivos de teste.

#### Por que é crítico em saúde pública
- Um bug no cruzamento de casos notificados com focos pode fazer operadores ignorarem focos de risco reais próximos a surtos
- Um bug no SLA pode fazer alertas críticos não serem disparados
- Um bug no trigger de casos pode fazer registros de doenças desaparecerem silenciosamente
- Nenhum desses bugs seria detectado automaticamente

#### Impacto histórico observado
Ao menos 7 patches de RLS em 2026 indicam que erros de segurança foram encontrados em produção. `[OBSERVADO]` pelas migrations de correção catalogadas em `06-rls-e-seguranca.md`.

#### Ação corretiva
Ver DT-10 em `09-divida-tecnica.md`. Prioridade: testar primeiro as funções de cálculo de SLA, lógica de state machine de `focos_risco`, e a função de normalização de score YOLO.

---

### RR-02 — `enrichItensComFoco()` é Ponto Único de Falha

**Severidade:** ALTA
**Probabilidade:** Baixa (mas impacto alto)
**Status:** Observado na arquitetura

#### Descrição
A função `enrichItensComFoco()` em `api.ts` é responsável por reconstruir os campos `@virtual` de `levantamento_itens` a partir de `focos_risco`. Todos os componentes que exibem status de atendimento, ação aplicada, operador responsável, e data de resolução dependem desta função. `[OBSERVADO]`

#### Por que é ponto único de falha
- Se a função tiver um bug na lógica de join, todos os itens aparecem sem status
- Se `focos_risco` ficar temporariamente indisponível, todos os levantamentos ficam sem informações de atendimento
- Sem testes, um refactoring dessa função pode quebrar silenciosamente toda a listagem de levantamentos

#### Ação corretiva
Adicionar testes unitários para `enrichItensComFoco()` com casos de: item sem foco relacionado, item com foco em vários estados, item com múltiplos focos históricos.

---

### RR-03 — Duplicidade SLA: Risco de Divergência Silenciosa

**Severidade:** MÉDIA
**Probabilidade:** Média
**Status:** Ver DT-05

#### Descrição
A implementação dupla de cálculo de SLA (TypeScript + PL/pgSQL) representa um risco de regressão silenciosa: se as implementações divergirem, o operador vê uma estimativa diferente do SLA real. `[OBSERVADO]`

#### Cenário de falha
1. Desenvolvedor atualiza `SLA_RULES` em `sla.ts` para um novo cliente
2. Esquece de atualizar a função `sla_aplicar_fatores()` no banco
3. O frontend exibe o SLA correto (pelo TypeScript)
4. O banco registra o SLA errado (pelo PL/pgSQL)
5. Alertas de SLA crítico disparam no horário errado
6. Nenhum erro é exibido — a divergência é silenciosa

---

## Riscos de Escalabilidade

### RE-01 — Sem Paginação em Listagens Críticas

**Severidade:** ALTA
**Probabilidade:** Alta (cresce com uso)
**Status:** Observado em múltiplos componentes

#### Descrição
Várias listagens importantes carregam todos os registros de uma vez sem paginação ou virtualização. Em municípios com volume alto de dados, isso pode se tornar um problema. `[INFERIDO]` a partir do padrão de queries observado em `api.ts`.

#### Listagens de risco
| Componente | Query | Risco |
|------------|-------|-------|
| `AdminCasosNotificados.tsx` | `api.casosNotificados.list(clienteId)` | Municípios com surto podem ter centenas de casos |
| `OperadorListaImoveis.tsx` | `api.imoveis.list(clienteId)` | Municípios grandes têm milhares de imóveis |
| `AdminLevantamentos.tsx` | `api.levantamentos.list(clienteId)` | Prefeituras com histórico longo têm muitos levantamentos |

#### Ação corretiva
Adicionar paginação com cursor (Supabase suporta `.range(from, to)`) ou filtros obrigatórios que limitem o conjunto de dados (ex: filtro de ciclo atual).

---

### RE-02 — `levantamento_analise_ia` Cresce sem Limpeza

**Severidade:** MÉDIA
**Probabilidade:** Alta (crescimento garantido)
**Status:** Observado pela ausência de política de retenção

#### Descrição
Cada voo processa imagens e pode gerar registros em `levantamento_analise_ia`. Não há política de retenção ou limpeza periódica desta tabela. `[OBSERVADO]` pela ausência de migrations ou jobs de limpeza.

#### Impacto
O custo de armazenamento do Supabase cresce indefinidamente. Queries na tabela ficam mais lentas com o tempo. O `payload` JSONB dos registros pode ser grande (inclui resultado do Claude).

---

### RE-03 — Cloudinary sem Política de Retenção

**Severidade:** BAIXA
**Probabilidade:** Alta (crescimento garantido)
**Status:** Observado pela ausência de código de limpeza

#### Descrição
Evidências fotográficas de vistorias e levantamentos são enviadas para o Cloudinary. Não há lógica de limpeza de imagens de levantamentos encerrados ou de prefeituras desativadas. `[OBSERVADO]` pela ausência de chamadas à API de deleção do Cloudinary.

#### Ação corretiva
Implementar job periódico que limpe imagens de levantamentos com mais de X meses (parâmetro por cliente).

---

## Tabela-resumo de riscos priorizados

| ID | Risco | Severidade | Probabilidade | Ação urgente? |
|----|-------|-----------|---------------|---------------|
| RS-01 | Pipeline Python com service_role | CRÍTICA | Média | Sim — auditar imediatamente |
| RR-01 | Sem testes em sistema de saúde | CRÍTICA | Alta | Sim — iniciar testes unitários |
| RS-02 | Canal Cidadão sem rate limiting | ALTA | Alta | Sim — implementar rate limit |
| ~~RD-01~~ | ~~payload JSONB sobrescrito em surto~~ | ~~ALTA~~ BAIXA | Inexistente | ✅ Resolvido historicamente em 2026-07 |
| RD-02 | Usuário dev em produção | ALTA | Média | Sim — verificar banco imediatamente |
| RS-03 | ~~Tabelas sem RLS confirmado~~ | ~~ALTA~~ BAIXO | ~~Média~~ Resolvido | ✅ Auditado e corrigido em 2026-07-12 |
| RS-04 | Edge Functions sem auditoria | ALTA | Baixa | Verificar nos próximos sprints |
| RO-01 | Sem visibilidade do pipeline | ALTA | Alta | Planejar painel de monitoramento |
| RO-02 | Web Push não funciona no iOS | ALTA | Alta | Implementar fallback |
| RR-02 | enrichItensComFoco ponto único | ALTA | Baixa | Testar quando houver suite |
| RE-01 | Sem paginação em listagens | ALTA | Alta | Adicionar progressivamente |
| RS-05 | Supervisor acessa /admin/clientes | MÉDIA | Baixa | Próximo sprint de segurança |
| RS-06 | SECURITY DEFINER sem auditoria | MÉDIA | Baixa | Auditoria trimestral |
| RD-03 | GPS do agente em vistorias | MÉDIA | Baixa | Verificar com jurídico |
| RO-03 | CNES sync sobrescreve dados manuais | MÉDIA | Média | Corrigir lógica de merge |
| RR-03 | Divergência SLA silenciosa | MÉDIA | Média | Consolidar implementação |
| RE-02 | levantamento_analise_ia sem limpeza | MÉDIA | Alta | Política de retenção |
| RO-04 | Relatório sem log de entrega | BAIXA | Média | Backlog |
| RE-03 | Cloudinary sem limpeza | BAIXA | Alta | Backlog |

---

## Plano de ação imediata (antes do próximo deploy)

Os itens abaixo são verificações de baixo custo que devem ser feitas antes do próximo deploy em produção:

1. **Verificar usuário dev em produção:**
   ```sql
   SELECT id, email, last_sign_in_at FROM auth.users
   WHERE email ILIKE '%luiz%' OR email ILIKE '%dev%';
   ```

2. **Verificar RLS em todas as tabelas** (auditoria concluída — manter como verificação periódica):
   ```sql
   -- spatial_ref_sys excluída: extensão PostGIS, dados públicos, sem risco.
   -- Deve retornar zero linhas após aplicação de 20260712010000
   SELECT tablename FROM pg_tables
   WHERE schemaname = 'public'
     AND rowsecurity = false
     AND tablename NOT IN ('spatial_ref_sys')
   ORDER BY tablename;
   ```

3. **Verificar key do pipeline Python:**
   Abrir o código Python e confirmar se usa `SUPABASE_SERVICE_KEY` ou `SUPABASE_ANON_KEY`.

4. ~~**Verificar payload de cruzamento** (RD-01 resolvido — não é mais necessário):~~
   O `payload` foi limpo pela migration `20260710020000`. A chave `caso_notificado_proximidade` não existe mais em nenhum item. Fonte canônica: `focos_risco.casos_ids` e `caso_foco_cruzamento`.

---

*Documento baseado no código-fonte real. Versão 2.1.1, análise em 2026-03-26. Atualizado em 2026-07-12: RD-01 encerrado (QW-03).*
