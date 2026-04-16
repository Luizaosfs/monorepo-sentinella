# 07 — Regras de Negócio

> **Para quem é este documento:** desenvolvedores, analistas e gestores que precisam entender o que o sistema garante, onde cada regra vive e quais são os pontos frágeis ou ambíguos.

**Convenção de localização:**
- `[BANCO]` — trigger, constraint ou função PL/pgSQL no PostgreSQL
- `[TS]` — TypeScript no frontend (api.ts, types, hooks, componentes)
- `[AMBOS]` — duplicado nos dois lados
- `[RLS]` — política de Row Level Security

---

## 1. Regras de Planejamento

### RN-P1: Um planejamento por região/tipo
Um planejamento pertence a exatamente um cliente, uma região e tem um tipo (`DRONE` ou `MANUAL`). Não há restrição de unicidade formal entre combinações, mas a convenção operacional é criar um planejamento por área de cobertura.

**Localização:** `[TS]` — validação no formulário de criação.

### RN-P2: Planejamento pode ser ativado e desativado
Campo `ativo` no planejamento. Apenas planejamentos ativos aparecem para seleção ao criar levantamentos e itens manuais. Admin/supervisor pode ativar/desativar.

**Localização:** `[BANCO]` — índice parcial `WHERE ativo = true`. `[TS]` — filtro na query `api.planejamentos.list`.
**Evidência:** migration `20250306170000`.

### RN-P3: Planejamento tipo DRONE habilita o pipeline externo
O campo `tipo_entrada` do levantamento vinculado ao planejamento determina se o processamento é `DRONE` ou `MANUAL`. O pipeline Python só injeta dados em levantamentos do tipo `DRONE`.

---

## 2. Regras de Levantamento

### RN-L1: Apenas um levantamento por planejamento por dia
**Regra mais importante deste módulo.** Não podem existir dois levantamentos para o mesmo planejamento na mesma data de voo.

**Localização:** `[BANCO]` — índice único `(cliente_id, planejamento_id, data_voo, tipo_entrada)` + função RPC `criar_levantamento_item_manual` que reutiliza o levantamento do dia se já existir.
**Evidência:** migration `20250308120000_levantamento_um_por_dia.sql`.

### RN-L2: Tipo de entrada é imutável após criação
O campo `tipo_entrada` (`DRONE` ou `MANUAL`) não pode ser alterado após o levantamento ser criado. Itens inseridos pelo pipeline Python herdam `DRONE`; itens criados pelo operador via formulário herdam `MANUAL`.

**Localização:** `[BANCO]` — constraint `chk_levantamentos_tipo_entrada`. `[TS]` — sem formulário de edição de tipo.

### RN-L3: Levantamento é o agrupador de itens de um dia
Um levantamento não tem "status" próprio — ele existe apenas como container. O status operacional vive nos `levantamento_itens` (e agora em `focos_risco`).

---

## 3. Regras de Levantamento Item

### RN-I1: Item é imutável após criado
**Observado como intenção clara do sistema.** A partir da migration `20260711000000`, um trigger (`trg_focos_risco_imutavel_levantamento_item`) bloqueia UPDATE nos campos de atendimento do `levantamento_item`. O item representa o que foi *encontrado* — não o que foi *feito*.

**Localização:** `[BANCO]` — trigger de proteção + colunas removidas.

### RN-I2: SLA automático apenas para prioridades P1, P2 e P3
**Regra adicionada em julho de 2026.** Ao inserir um `levantamento_item`, o trigger de SLA só cria `sla_operacional` se a prioridade for P1 (Crítica/Urgente), P2 (Alta) ou P3 (Média/Moderada). Itens P4 (Baixa) e P5 (Monitoramento) **não geram SLA automático**.

A função auxiliar `levantamento_item_prioridade_elegivel_sla_auto()` normaliza tanto os códigos novos (`p1`,`p2`,`p3`) quanto os rótulos legados (`Crítica`, `Alta`, `Média`, `Moderada`).

**Localização:** `[BANCO]` — função + trigger em `20260606100000`.
**Risco:** um item P4 com foco real não terá prazo de atendimento rastreado automaticamente.

### RN-I3: Idempotência do SLA — não cria se já existe
O trigger de SLA verifica se já existe um `sla_operacional` aberto para o item antes de criar um novo. Isso garante que reinserções acidentais não dupliquem SLAs.

**Localização:** `[BANCO]` — condição `NOT EXISTS` dentro do trigger.

### RN-I4: Recorrência eleva prioridade para Urgente
Se um novo item for inserido no mesmo endereço (ou dentro de **50 metros**) de um item existente nos **últimos 30 dias**, o trigger de recorrência:
1. Cria/atualiza registro em `levantamento_item_recorrencia`
2. Eleva a prioridade do novo item para `Urgente` (se ainda não for Urgente ou Crítico)
3. Recalcula as horas de SLA com a nova prioridade
4. Atualiza o `sla_operacional` já criado pelo trigger anterior

**Importante:** O trigger de recorrência é nomeado `trg_levantamento_item_recorrencia` — alfabeticamente posterior ao trigger de SLA — o que garante que o SLA já existe quando a recorrência tenta atualizá-lo.

**Localização:** `[BANCO]` — migration `20250311120000`.
**Ponto frágil:** a janela de 30 dias não tem parâmetro configurável por cliente.

### RN-I5: Score YOLO deve ser normalizado antes de exibir
O pipeline Python pode gravar `score_final` em escala `0–1` ou `0–100`. O frontend sempre normaliza antes de exibir ou comparar usando `normalizeScore()` em `scoreUtils.ts`.

Faixas após normalização:
- ≥ 0.85 → Muito alta (alta certeza de foco real)
- ≥ 0.65 → Alta
- ≥ 0.45 → Média
- < 0.45 → Baixa (priorizar vistoria manual)

**Localização:** `[TS]` — `src/lib/scoreUtils.ts`.
**Risco:** se o banco receber um score `87` e o frontend não normalizar, exibirá `87%` ao invés de `87/100 = 87%` — mas a lógica de prioridade baseada em faixas estaria errada.

---

## 4. Regras de Foco de Risco

### RN-F1: State machine de 7 estados com transições válidas definidas no banco

```
suspeita
  └─► em_triagem
        ├─► aguarda_inspecao
        │     ├─► confirmado
        │     │     └─► em_tratamento
        │     │           ├─► resolvido     ← estado terminal
        │     │           └─► descartado    ← estado terminal
        │     └─► descartado               ← estado terminal
        └─► descartado                     ← estado terminal
```

**Transições inválidas são rejeitadas pelo banco** via função `fn_transicionar_foco()` (RPC com SECURITY DEFINER).

**Localização:** `[BANCO]` — CHECK constraint + RPC + trigger de validação. `[TS]` — `TRANSICOES_PERMITIDAS` em `database.ts` (para validação antecipada na UI).

### RN-F2: Todo histórico de transição é imutável (ledger append-only)
A tabela `foco_risco_historico` recebe uma entrada a cada mudança de estado. A política RLS bloqueia DELETE: `DELETE USING (false)`. Nenhum usuário, nem admin, pode apagar o histórico.

**Localização:** `[BANCO]` — trigger `trg_focos_risco_historico` + política RLS.

### RN-F3: SLA inicia ao confirmar, fecha ao resolver ou descartar
- `focos_risco.confirmado_em` é o timestamp de início do SLA
- Ao transicionar para `resolvido` ou `descartado`, o trigger `fn_fechar_sla_ao_resolver_foco` fecha o `sla_operacional` correspondente

**Localização:** `[BANCO]` — `fn_iniciar_sla_ao_confirmar_foco` + `fn_fechar_sla_ao_resolver_foco` em `20260710010000`.

### RN-F4: Recorrência cria novo foco com `foco_anterior_id`
Quando um foco resolve e reaparece no mesmo local, um novo `focos_risco` é criado com `foco_anterior_id` apontando para o anterior. Isso permite rastrear histórico de recorrências de forma encadeada.

**Localização:** `[BANCO]` — campo FK em `focos_risco`. `[TS]` — `FocoRiscoPrioridade` em `database.ts`.

### RN-F5: Cinco origens possíveis, cada uma com contexto diferente
| Origem | Como nasce | Contexto extra |
|--------|-----------|----------------|
| `drone` | Pipeline Python via RPC | `origem_levantamento_item_id` preenchido |
| `agente` | Vistoria domiciliar (depósito com larva) | `origem_vistoria_id` preenchido |
| `cidadao` | Canal Cidadão via QR code | Sem usuário autenticado |
| `pluvio` | Análise pluviométrica diária | `item_id` do pluvio_operacional_item |
| `manual` | Criado diretamente pelo gestor | `origem_levantamento_item_id` opcional |

### RN-F6: Prioridades P1–P5 (sistema novo) convivem com rótulos legados
O sistema novo usa P1–P5. O sistema legado (pré-focos_risco) usava `Crítica`, `Urgente`, `Alta`, `Moderada`, `Baixa`, `Monitoramento`. Funções de normalização convertem entre os dois esquemas.

**Ponto frágil:** dois esquemas de prioridade coexistindo. Um desenvolvedor novo pode misturar os dois.

---

## 5. Regras de SLA

### RN-S1: Prazos base por prioridade

| Prioridade | Prazo base | Equivalência legada |
|------------|-----------|---------------------|
| P1 | 4 horas | Crítica / Urgente |
| P2 | 12 horas | Alta |
| P3 | 24 horas | Moderada / Média |
| P4 | 72 horas | Baixa |
| P5 | 72 horas | Monitoramento |

**Mínimo absoluto:** 2 horas — nunca abaixo disso.

**Fonte oficial:** `[BANCO]` — `sla_horas_from_config()` + `sla_calcular_prazo_final()`. O valor em `sla_operacional.prazo_final` é a referência canônica.
**Frontend:** `SLA_RULES` em `sla.ts` e `calcularSlaHoras()` são usados apenas para simulação visual (ex: formulários de configuração). Não representam o prazo real gravado no banco. (QW-06)

### RN-S2: Fatores de redução climática (cumulativos)

| Condição | Redutor |
|----------|---------|
| Risco classificado como "Muito Alto" | −30% do prazo base |
| Persistência de chuva > 3 dias | −20% do prazo base |
| Temperatura média > 30°C | −10% do prazo base |

Os redutores são cumulativos. Um foco com risco Muito Alto + persistência > 3d + temp > 30°C teria prazo reduzido em −60%, sujeito ao mínimo de 2 horas.

**Localização:** `[AMBOS]` — `calcularSlaHoras()` em `sla.ts` + `sla_aplicar_fatores()` no banco.

### RN-S3: Horário comercial e feriados (quando configurado)
Se o cliente tiver `sla_config.horario_comercial.ativo = true`, o prazo final do SLA é calculado desconsiderando horários fora do expediente e feriados cadastrados em `sla_feriados`. O expediente tem horário de início e fim configuráveis por cliente.

**Localização:** `[BANCO]` — `sla_calcular_prazo_final()` em `20250311130000`.
**Importante:** `calcularSlaHoras()` no TypeScript **não** respeita feriados nem horário comercial — é apenas simulação visual. O cálculo real sempre ocorre no banco.

### RN-S4: SLA pode ser escalado
Quando um SLA vence sem resolução, o gestor (ou o job automático) pode escalá-lo. O escalamento:
1. Eleva a prioridade um nível acima (`Monitoramento → Baixa → Média → Alta → Urgente`)
2. Recalcula um novo prazo a partir do momento do escalamento
3. Preserva `prioridade_original` para auditoria
4. Marca `escalonado = true` e `escalonado_em = now()`

**Escala máxima:** `Urgente` e `Crítica` não escalam mais — permanecem no topo.

**Localização:** `[BANCO]` — `escalar_sla_operacional()` + `escalar_prioridade()`.

### RN-S5: SLA é fechado automaticamente ao concluir operação
Quando uma `operacao` tem seu status atualizado para `concluido`, o trigger `operacoes_on_status_concluido` atualiza o `sla_operacional` correspondente para `concluido` e preenche `concluido_em`.

**Localização:** `[BANCO]` — trigger em `20250306110000`.

### RN-S6: SLAs vencidos são marcados por job periódico
A função `marcar_slas_vencidos()` (chamada pela Edge Function `sla-marcar-vencidos`, cron frequente) varre o banco e marca como `vencido` + `violado=true` todos os SLAs com `prazo_final < now()` e `status IN ('pendente', 'em_atendimento')`.

**Localização:** `[BANCO]` — função + `[EDGE FUNCTION]` — `sla-marcar-vencidos`.

### RN-S7: Config de SLA pode ser diferente por região
O cliente pode configurar prazos específicos para cada região (`sla_config_regiao`). A função de cálculo de SLA prioriza a config da região antes da config global do cliente.

**Localização:** `[BANCO]` — migration `20250311180000`.

### RN-S8: Reabrir SLA recalcula prazo a partir de now() — adicionado QW-06
Quando um gestor reabre um SLA concluído via `api.sla.reabrir()`, o sistema:
1. Volta o status para `pendente`
2. Zera `concluido_em`
3. Define `inicio = now()`
4. Recalcula `prazo_final` a partir de now() usando as mesmas `sla_horas` originais
5. Limpa `violado = false`

O recálculo usa `sla_calcular_prazo_final()` respeitando horário comercial e feriados. Antes desta correção (QW-06), o prazo original era mantido e o item ficava imediatamente vencido.

**Localização:** `[BANCO]` — RPC `reabrir_sla()` em `20260714000000` + `[FRONTEND]` — `api.sla.reabrir()`.

### RN-S9: Falhas na criação automática de SLA são registradas — adicionado QW-06
Se o trigger `trg_levantamento_item_criar_sla_auto` falhar por qualquer razão, o erro é registrado na tabela `sla_erros_criacao` (levantamento_item_id + mensagem de erro + timestamp). O insert do levantamento_item **não é bloqueado** — o item é criado normalmente, mas ficará sem SLA.

Antes desta correção (QW-06), erros eram silenciados com `EXCEPTION WHEN others THEN RETURN NEW`, tornando itens sem SLA invisíveis.

**Visibilidade:** admin e gestor podem consultar `sla_erros_criacao` para identificar itens que entraram sem SLA.
**Localização:** `[BANCO]` — tabela + trigger atualizado em `20260714000000`.

### RN-S10: Escalação e reabertura registram o responsável — adicionado QW-07
As funções `escalar_sla_operacional()` e `reabrir_sla()` resolvem `auth.uid()` → `usuarios.id` internamente e preenchem `escalado_por` e `reaberto_por` na tabela `sla_operacional`. Ambos são `uuid REFERENCES usuarios(id)` e podem ser `NULL` para ações disparadas por jobs automáticos (que não têm sessão autenticada).

**Localização:** `[BANCO]` — colunas + funções atualizadas em `20260715000000`.

---

## 6. Regras de Vistoria Domiciliar

### RN-V1: Formulário em 5 etapas com dados progressivos
Cada etapa gera dados independentes que são persistidos ao banco ao final de cada passo. A sequência é: Responsável → Sintomas → Inspeção → Tratamento → Riscos. Não é possível registrar tratamento sem antes registrar inspeção.

**Localização:** `[TS]` — `OperadorFormularioVistoria.tsx` + componentes de etapa.

### RN-V2: Quantidade de focos não pode exceder inspecionados
Em cada tipo de depósito PNCD, `qtd_com_focos <= qtd_inspecionados`. A validação existe no frontend e deveria existir como CHECK constraint no banco.

**Localização:** `[TS]` — validação na Etapa 3. `[BANCO]` — **CHECK constraint pendente** (identificado como melhoria no roadmap).

### RN-V3: Sintomas com moradores afetados criam caso notificado automaticamente
Ao inserir `vistoria_sintomas` com `moradores_sintomas_qtd > 0`, o trigger `trg_sintomas_para_caso` cria automaticamente um `caso_notificado` com:
- `doenca = 'suspeito'`
- `status = 'suspeito'`
- Endereço do imóvel visitado
- Vínculo `gerou_caso_notificado_id` em `vistoria_sintomas`

**Localização:** `[BANCO]` — trigger em `20250318001000`, corrigido em `20260319225500`.

### RN-V4: Imóvel sem acesso gera registro de tentativa
Se o agente não consegue entrar no imóvel, registra:
- `acesso_realizado = false`
- `motivo_sem_acesso` (fechado, viagem, recusa, cachorro agressivo, calha inacessível, outro)
- `status = 'revisita'`
- Horário sugerido de retorno
- Foto externa (opcional)

**Localização:** `[TS]` — `VistoriaSemAcesso.tsx`. `[BANCO]` — colunas em `vistorias`.

### RN-V5: 3 tentativas sem acesso elevam imóvel a prioridade drone
**Contagem acumulada, sem janela temporal.** Se um imóvel acumular 3 ou mais vistorias com `acesso_realizado = false` em qualquer período, o trigger `fn_atualizar_perfil_imovel` marca:
- `imoveis.historico_recusa = true`
- `imoveis.prioridade_drone = true`

**Localização:** `[BANCO]` — trigger em `20250318002000`.
**Ponto frágil identificado:** sem janela temporal. Um imóvel que teve 3 tentativas há 2 anos e agora o morador mudou continuará marcado para drone indefinidamente.

### RN-V6: Calha inacessível deve atualizar o perfil do imóvel
Se o agente identificar calha inacessível durante a vistoria, `calha_acessivel = false` deve ser atualizado no perfil do imóvel ao finalizar.

**Localização:** `[TS]` — lógica em `OperadorFormularioVistoria.tsx (handleFinalize)`.

### RN-V7: Vistoria pode ser salva offline
Toda a sequência de criação de vistoria (create → depositos → sintomas → riscos) pode ser enfileirada no IndexedDB e executada ao reconectar.

**Localização:** `[TS]` — `offlineQueue.ts`, operação `save_vistoria`.

---

## 7. Regras de Casos Notificados e Cruzamento

### RN-C1: Caso notificado não armazena dados pessoais (LGPD)
A tabela `casos_notificados` nunca deve conter nome, CPF, data de nascimento ou qualquer identificador direto do paciente. Apenas endereço de residência e bairro para fins de cruzamento geoespacial.

**Localização:** `[BANCO]` — comentário explícito na migration. `[TS]` — aviso LGPD no formulário do notificador.

### RN-C2: Cruzamento automático caso↔foco em raio de 300m
Ao inserir um `caso_notificado`, o trigger `fn_cruzar_caso_com_focos` busca focos do mesmo cliente em raio de 300m via PostGIS (`ST_DWithin`) e:
1. Insere registro em `caso_foco_cruzamento` com a distância calculada
2. Eleva a prioridade do foco para `Crítico`
3. Atualiza `focos_risco.casos_ids` com o UUID do caso (via `array_append`)

**Esta lógica nunca deve ser replicada no frontend.**

**Localização:** `[BANCO]` — trigger em `20250318000000`, evoluído em `20260604000000` (R-38) e `20260710030000`.
**Nota:** o campo `payload` de `levantamento_itens` não é mais usado para armazenar relações de caso. Ver ADR-QW03 em `11-melhorias-priorizadas.md`.

### RN-C3: Unidades de saúde inativas não aceitam novos casos
O campo `ativo` em `unidades_saude` controla se a unidade pode registrar casos. Unidades sincronizadas pelo CNES que não aparecem mais na base federal são marcadas `ativo = false` (nunca deletadas — preserva histórico de casos anteriores).

**Localização:** `[BANCO]` — lógica na Edge Function `cnes-sync`. `[TS]` — filtro no formulário do notificador.

### RN-C4: Cluster de 3+ casos no mesmo bairro sugere planejamento
No painel `AdminCasosNotificados`, quando 3 ou mais casos confirmados aparecem no mesmo bairro, o sistema exibe um botão "Criar planejamento" para facilitar ação corretiva.

**Localização:** `[TS]` — lógica no componente de painel.
**Observação:** isso é uma sugestão de UI, não uma regra automática do banco.

---

## 8. Regras de Canal Cidadão

### RN-CC1: Denúncia sem autenticação via SECURITY DEFINER
O cidadão acessa a página pública `/denuncia/:slug/:bairroId` sem criar conta. A inserção é feita via RPC `canal_cidadao_denunciar` com `SECURITY DEFINER`, que valida o slug e insere diretamente.

**Localização:** `[BANCO]` — RPC em migration sprint4.

### RN-CC2: Slug identifica a prefeitura sem expor o cliente_id
O `slug` é um identificador amigável da prefeitura (ex: `prefeitura-angra`). É público e aparece no QR code. O `cliente_id` (UUID interno) nunca é exposto.

**Localização:** `[BANCO]` — campo `slug` em `clientes`. `[TS]` — parâmetro de rota.

### RN-CC3: Sem rate limiting implementado
**Risco identificado.** Não existe limite de denúncias por IP ou por período. Um atacante com o slug poderia inundar o sistema com denúncias falsas.

**Localização:** ausente.

---

## 9. Regras de Imóveis

### RN-IM1: Tipos de imóvel
`residencial`, `comercial`, `terreno`, `ponto_estrategico`.

### RN-IM2: Prioridade drone é calculada por trigger, não manualmente
Embora o gestor possa marcar `prioridade_drone = true` manualmente via `api.imoveis.marcarPrioridadeDrone()`, a principal forma de ativação é automática via trigger das 3 tentativas sem acesso.

### RN-IM3: View `v_imovel_historico_acesso` é somente leitura
Nunca inserir ou atualizar diretamente. É calculada pelo banco a partir de `vistorias`.

---

## 10. Regras de Operação por Perfil

### RN-OP1: Operador vê apenas seus itens e SLAs
O operador tem visão restrita: apenas os `levantamento_itens` e `sla_operacional` atribuídos a ele aparecem no seu portal.

**Localização:** `[TS]` — filtro por `operador_id` em `api.itens.listByCliente`. `[RLS]` — `is_operador()` com restrição adicional.

### RN-OP2: Agente registra vistoria, não atende foco de drone diretamente
O perfil Agente (`/agente/*`) é distinto do Operador (`/operador/*`). O agente faz vistoria domiciliar estruturada com o formulário PNCD. O operador atende focos de levantamento identificados pelo drone ou manualmente.

**Dúvida documentada:** existe sobreposição de função em alguns fluxos. Um operador pode criar item manual (`/operador/novo-item-manual`), o que tecnicamente é similar ao que o agente faz.

### RN-OP3: Admin vê todos os clientes; supervisor vê apenas o seu
**Distinção fundamental de multitenancy.** O admin da plataforma pode selecionar qualquer prefeitura. O supervisor vê apenas os dados da sua prefeitura.

**Localização:** `[TS]` — `useClienteAtivo.tsx`. `[RLS]` — `usuario_pode_acessar_cliente()`.

### RN-OP4: Notificador só pode registrar casos, não gerenciar focos
O papel `notificador` tem acesso exclusivo ao portal `/notificador/registrar`. Não tem acesso ao dashboard nem ao painel admin.

**Localização:** `[TS]` — guard de rota (implícito no App.tsx). `[RLS]` — políticas adicionadas em `20260605030000`.

---

## 11. Regras de Quota

### RN-Q1: Quota de voos mensais é enforced pelo banco
Se um cliente tiver configuração de quota em `cliente_quotas.voos_mes`, o trigger `trg_check_quota_voos` bloqueia qualquer INSERT em `voos` quando o limite do mês corrente foi atingido. A exceção lançada chega ao frontend como erro Supabase.

**Localização:** `[BANCO]` — trigger em `20260319241000`.

### RN-Q2: Sem quota configurada, não há bloqueio
Se o cliente não tiver linha em `cliente_quotas`, a quota é ignorada e o voo é permitido.

**Localização:** `[BANCO]` — condição `IF v_limite IS NULL THEN RETURN NEW`.

### RN-Q3: QuotaBanner exibe alerta progressivo no frontend
Em 70% de uso, o banner fica laranja. Em 100%, vermelho. Isso é apenas informativo — o bloqueio real é o trigger do banco.

---

## 12. Regras implícitas que deveriam estar explícitas

| Regra implícita | Onde está | Risco |
|----------------|-----------|-------|
| ~~`payload` JSONB do levantamento_item é sobrescrito em surtos~~ | ~~`[BANCO]` trigger de cruzamento~~ | ~~Perda de dados de múltiplos casos~~ ✅ Resolvido (ADR-QW03) |
| Janela de 30 dias da recorrência não é configurável por cliente | `[BANCO]` hardcoded no trigger | Inflexível para municípios com padrões diferentes |
| 3 tentativas sem acesso não têm janela temporal | `[BANCO]` trigger de perfil | Imóveis ficam marcados para sempre |
| SLA P4/P5 existe mas não é criado automaticamente | `[BANCO]` conditional no trigger | Focos baixa prioridade sem prazo rastreado |
| Supervisor = usuário no banco (mesmo nível de RLS) | `[RLS]` sem distinção | Controle fino apenas no frontend |
| Seed de operador dev possivelmente em produção | `[BANCO]` migration `20250306160000` | Usuário não-autorizado pode existir em produção |
| Score YOLO normalizado apenas no frontend, não validado no banco | `[TS]` sem constraint de range | Score `87` e `0.87` coexistem sem aviso |

---

## 13. Pontos de duplicidade ou conflito entre regras

| Regra | Local 1 | Local 2 | Risco |
|-------|---------|---------|-------|
| Cálculo de horas de SLA | `calcularSlaHoras()` em `sla.ts` | `sla_aplicar_fatores()` em PL/pgSQL | Divergência silenciosa |
| Normalização de score YOLO | `scoreUtils.ts` | Inline em componentes legados (possível) | Exibição incorreta |
| Prioridade de foco | P1–P5 (focos_risco novo) | Crítica/Alta/Média/Baixa (levantamento_item legado) | Confusão para devs novos |
| Status de atendimento | `focos_risco.status` (banco) | `LevantamentoItem.status_atendimento` (virtual no TS) | Se `enrichItensComFoco` falhar, exibe null |
| Recorrência | `levantamento_item_recorrencia` (sistema antigo) | `focos_risco.foco_anterior_id` (sistema novo) | Dois sistemas, consultas diferentes |

---

*Documento baseado no código-fonte real. Versão 2.1.0, análise em 2026-03-26.*
