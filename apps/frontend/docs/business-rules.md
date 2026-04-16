# Sentinella — Business Rules Catalogue

Extracted from: `src/types/sla.ts`, `src/types/database.ts`, `src/services/api.ts`, `src/lib/queryConfig.ts`, all `supabase/migrations/`, `CLAUDE.md`.

---

## PLANEJAMENTO

**RULE-01 | Planejamento | Tipos permitidos: drone ou manual**
- Where: `CLAUDE.md` + migration `20250307100000_planejamento_tipo_levantamento.sql`
- A `planejamento` pertence a um `cliente` (prefeitura) e a uma região/bairro. O campo `tipo_entrada` distingue `DRONE` vs `MANUAL`.
- Evidence type: DB constraint + TypeScript type `LevantamentoItem.tipo_entrada`
- Risk: Itens criados sem `tipo_entrada` não disparam a lógica correta de score/SLA.
- Recommendation: Garantir NOT NULL constraint em `tipo_entrada` na tabela `levantamento_itens`.
- Priority: HIGH

**RULE-02 | Planejamento | Um levantamento por dia por planejamento**
- Where: migration `20250308120000_levantamento_um_por_dia.sql`
- Regra de unicidade: não é permitido criar mais de um levantamento por planejamento no mesmo dia.
- Evidence type: DB unique constraint (date + planejamento_id)
- Risk: Quebra de rastreabilidade se a restrição for contornada via insert direto.
- Recommendation: Nunca inserir levantamentos diretamente — sempre via RPC ou `api.levantamentos`.
- Priority: HIGH

**RULE-03 | Planejamento | Vinculado a regiao_id obrigatório para resolução de SLA por região**
- Where: migration `20250311200000_planejamento_regiao_id.sql` + `20250311180000_sla_config_por_regiao.sql`
- `planejamento.regiao_id` é obrigatório para que o trigger `sla_resolve_config()` aplique a configuração de SLA da região correta.
- Evidence type: FK column + trigger dependency
- Risk: Planejamentos sem `regiao_id` caem na config padrão de SLA — podem receber prazos incorretos.
- Recommendation: Validar presença de `regiao_id` ao criar planejamento no frontend.
- Priority: MEDIUM

**RULE-04 | Planejamento | Drone: quota de voos verificada antes de criar**
- Where: `AdminVoos.tsx` + `api.quotas.verificar` + migration `20250311190000_cliente_quotas.sql`
- Antes de abrir o formulário de novo voo com `tipo_entrada=DRONE`, o sistema checa a quota `voos_mes` do cliente.
- Evidence type: Frontend check via `api.quotas.verificar`
- Risk: Quota pode ser ultrapassada via API direta sem verificação.
- Recommendation: Adicionar check de quota também no backend (trigger ou RPC).
- Priority: MEDIUM

**RULE-05 | Planejamento | Badge de imóveis marcados para drone ao criar planejamento DRONE**
- Where: `AdminPlanejamentos.tsx`
- Ao criar um planejamento com `tipo_entrada=DRONE`, o sistema exibe badge informativo com contagem de imóveis com `prioridade_drone=true` na região.
- Evidence type: `api.imoveis.countPrioridadeDroneByCliente`
- Risk: Informativo apenas — sem impacto em dados.
- Recommendation: Considerar vínculo formal entre planejamento drone e lista de imóveis prioritários.
- Priority: LOW

---

## LEVANTAMENTO

**RULE-06 | Levantamento | Deve estar ligado a um planejamento**
- Where: `CLAUDE.md` regras importantes + `database.ts` interface `Levantamento`
- Todo levantamento possui `planejamento_id` referenciando o planejamento pai. Preserva rastreabilidade completa planejamento→levantamento→item→evidência.
- Evidence type: DB FK + `Levantamento.planejamento_id`
- Risk: Levantamentos órfãos (sem planejamento) quebram o fluxo de triagem IA e relatórios.
- Recommendation: Adicionar NOT NULL constraint em `planejamento_id` se ainda não existir.
- Priority: HIGH

**RULE-07 | Levantamento | config_fonte rastreia origem da config do drone**
- Where: migration `20250311160000_voos_piloto_levantamento_config_fonte.sql` + `database.ts`
- O campo `levantamentos.config_fonte` registra se a configuração de risco foi carregada do Supabase (`supabase`) ou do JSON local (`local_json:yolo,risk`).
- Evidence type: String field com enum implícito
- Risk: Fallbacks para JSON local podem produzir classificações desatualizadas sem alerta claro.
- Recommendation: `AdminVoos.tsx` já exibe badge de alerta — manter esse comportamento e considerar alertas push para gestores.
- Priority: MEDIUM

---

## LEVANTAMENTO_ITEM

**RULE-08 | LevantamentoItem | Ciclo de vida: pendente → em_atendimento → resolvido**
- Where: `database.ts` `StatusAtendimento` + `api.itens.updateAtendimento` + migration `20250307160000_levantamento_itens_status_atendimento.sql`
- Transições válidas: `pendente` → `em_atendimento` (operador inicia atendimento) → `resolvido` (operador conclui). Campo `data_resolucao` registra timestamp de conclusão.
- Evidence type: TypeScript enum `StatusAtendimento` + DB column
- Risk: Não há constraint de transição de estado no banco — transições inválidas (ex: `pendente` → `resolvido`) são tecnicamente possíveis.
- Recommendation: Adicionar constraint ou trigger que valide sequência de transições.
- Priority: MEDIUM

**RULE-09 | LevantamentoItem | Histórico de status auditado automaticamente**
- Where: migration `20250311100000_levantamento_item_status_historico.sql` + `database.ts` `LevantamentoItemStatusHistorico`
- O trigger `trg_levantamento_item_status_historico` grava em `levantamento_item_status_historico` cada mudança de `status_atendimento`, incluindo `acao_aplicada_anterior`, `acao_aplicada_nova`, `alterado_por` e timestamp.
- Evidence type: DB trigger + audit table
- Risk: Auditoria incompleta se `status_atendimento` for alterado via UPDATE direto no banco (fora de RLS).
- Recommendation: Nunca alterar `status_atendimento` diretamente no banco — sempre via `api.itens.updateAtendimento`.
- Priority: HIGH

**RULE-10 | LevantamentoItem | tipo_entrada MANUAL não tem score YOLO**
- Where: `CLAUDE.md` + `ItemDetailPanel.tsx` (normalizeScore)
- Itens com `tipo_entrada === 'MANUAL'` não possuem `score_final`. O frontend deve exibir "Entrada manual" no lugar da barra de confiança.
- Evidence type: Conditional rendering in `ItemDetailPanel.tsx`
- Risk: Comparações de prioridade entre itens DRONE e MANUAL podem ser enganosas se o score for assumido como presente.
- Recommendation: Sempre checar `tipo_entrada` antes de usar `score_final`.
- Priority: HIGH

**RULE-11 | LevantamentoItem | score_final pode ser 0–1 ou 0–100: normalização obrigatória**
- Where: `CLAUDE.md` + `ItemScoreBadge` component (`normalizeScore`)
- O pipeline Python pode gravar `score_final` em qualquer das duas escalas. Regra: se `raw > 1`, divide por 100.
- Evidence type: `normalizeScore(raw)` em `ItemDetailPanel.tsx` e `ItemScoreBadge`
- Risk: Exibir `0.87` como `87%` ou `87` como `8700%` se normalização for omitida.
- Recommendation: Centralizar normalização em função única — já implementado em `ItemScoreBadge.normalizeScore`.
- Priority: HIGH

**RULE-12 | LevantamentoItem | Faixas de confiança YOLO**
- Where: `CLAUDE.md` + `ItemScoreBadge.getScoreConfig`
- `>= 0.85` → Muito alta (vermelho); `>= 0.65` → Alta (laranja); `>= 0.45` → Média (âmbar); `< 0.45` → Baixa (verde — priorizar vistoria manual).
- Evidence type: `getScoreConfig()` function
- Risk: Faixas redefinidas em múltiplos componentes podem divergir.
- Recommendation: Exportar `getScoreConfig` de um local único — já centralizado em `ItemScoreBadge`.
- Priority: MEDIUM

**RULE-13 | LevantamentoItem | Recorrência detectada automaticamente em 30 dias / 50m**
- Where: migration `20250311120000_levantamento_item_recorrencia.sql`
- O trigger `trg_levantamento_item_recorrencia` (dispara DEPOIS de `trg_levantamento_item_criar_sla_auto` por ordem alfabética) detecta focos recorrentes: mesmo `endereco_curto` OU coordenadas dentro de 50m, nos últimos 30 dias.
- Ao detectar recorrência (≥ 2 ocorrências):
  1. Cria/atualiza registro em `levantamento_item_recorrencia`
  2. Eleva prioridade do novo item para `Urgente` (se < Urgente)
  3. Recalcula `sla_horas` com nova prioridade
  4. Atualiza o `sla_operacional` já criado pelo trigger anterior
- Evidence type: DB trigger + `v_recorrencias_ativas` view
- Risk: Elevação automática de prioridade pode surpreender gestores se não houver notificação explícita.
- Recommendation: Emitir notificação ou badge "recorrente" no painel admin.
- Priority: HIGH

**RULE-14 | LevantamentoItem | SLA criado automaticamente no INSERT**
- Where: migration `20250309130000_sla_levantamento_item.sql`
- O trigger `trg_levantamento_item_criar_sla_auto` cria um registro em `sla_operacional` automaticamente ao inserir um `levantamento_item`, usando `prioridade` + config do cliente/região para calcular `sla_horas` e `prazo_final`.
- Evidence type: DB trigger AFTER INSERT ON levantamento_itens
- Risk: Se a config de SLA da região não existir, o trigger pode falhar silenciosamente ou usar defaults incorretos.
- Recommendation: Garantir que `seedDefaultSlaConfig` seja executado em todo novo cliente.
- Priority: HIGH

---

## SLA

**RULE-15 | SLA | Prazos base por prioridade**
- Where: `src/types/sla.ts` `SLA_RULES` + `calcularSlaHoras()`
- Crítica/Urgente: 4h | Alta: 12h | Moderada/Média: 24h | Baixa/Monitoramento: 72h
- Evidence type: `SLA_RULES` constant + TypeScript function
- Risk: Duplicar essa tabela em outros arquivos pode gerar inconsistências.
- Recommendation: Nunca definir prazos fora de `src/types/sla.ts`.
- Priority: CRITICAL

**RULE-16 | SLA | Redutores de prazo**
- Where: `src/types/sla.ts` `calcularSlaHoras()`
- Redutor 1: `-30%` se `classificacaoRisco === 'Muito Alto'`
- Redutor 2: `-20%` se `persistencia7d === 'alta'` (persistência > 3 dias)
- Redutor 3: `-10%` se `tempMediaC > 30`
- Evidence type: TypeScript function with conditional multipliers
- Risk: Redutores são cumulativos — podem reduzir o prazo abaixo do mínimo se não houver proteção.
- Recommendation: Já protegido pelo mínimo absoluto de 2h via `Math.max(2, Math.round(horas))`.
- Priority: HIGH

**RULE-17 | SLA | Mínimo absoluto de 2 horas**
- Where: `src/types/sla.ts` `calcularSlaHoras()` — última linha: `return Math.max(2, Math.round(horas))`
- Independente de redutores ou configurações, nenhum SLA pode ter prazo inferior a 2 horas.
- Evidence type: `Math.max(2, ...)` hardcoded
- Risk: Baixo — regra está na função canônica.
- Recommendation: Documentar esse mínimo no campo `sla_horas` da tabela para auditoria.
- Priority: HIGH

**RULE-18 | SLA | Status: pendente → em_atendimento → concluido | vencido**
- Where: `src/types/sla.ts` `SlaStatus`
- `pendente` → `em_atendimento` (operador inicia) → `concluido` (resolvido a tempo) ou `vencido` (prazo expirado).
- Campo `violado: boolean` marca violação mesmo após conclusão tardia.
- Evidence type: TypeScript type + DB columns `status`, `violado`
- Risk: `vencido` pode ser definido tanto pelo campo `status` quanto por `violado=true` — lógica duplicada.
- Recommendation: `getSlaVisualStatus()` já unifica: checa `violado` primeiro, depois `status`, depois tempo restante.
- Priority: MEDIUM

**RULE-19 | SLA | Iminência: warning quando < 20% do tempo restante**
- Where: `src/types/sla.ts` `getSlaVisualStatus()`
- Se `remaining < totalDuration * 0.2` → status visual `warning`. Trigger de push via Edge Function `sla-push-critico` para SLAs com ≤ 1h restante.
- Evidence type: `getSlaVisualStatus()` + `useSlaAlerts.ts` + Edge Function
- Risk: Push de Web Push requer subscrição prévia — operadores sem subscrição não recebem alertas.
- Recommendation: Auto-subscribe implementado em `useSlaAlerts.ts` — manter esse comportamento.
- Priority: HIGH

**RULE-20 | SLA | Feriados e horário comercial impactam prazo_final**
- Where: migration `20250311130000_sla_feriados_horario_comercial.sql` + `api.slaFeriados.*`
- Tabela `sla_feriados` por cliente. Função `sla_calcular_prazo_final` considera dias úteis e horário comercial ao calcular `prazo_final`.
- Evidence type: DB table + RPC function
- Risk: Feriados não cadastrados fazem o sistema tratar dias não-úteis como úteis.
- Recommendation: Executar `api.slaFeriados.seedNacionais` ao criar novo cliente — já implementado via `seedDefaultSlaFeriados`.
- Priority: MEDIUM

**RULE-21 | SLA | Escalonamento: prioridade_original preservada**
- Where: `api.sla.escalar` + migration `20250309110000_sla_vencidos_escalamento.sql`
- Ao escalar, `prioridade_original` é gravada antes da elevação, `escalonado=true`, `escalonado_em` = now().
- Evidence type: DB columns + `escalar_sla_operacional()` RPC
- Risk: Escalonamentos em cadeia podem sobrescrever `prioridade_original` se não houver proteção.
- Recommendation: Verificar se a função protege `prioridade_original` de ser sobrescrita em escalamentos subsequentes.
- Priority: MEDIUM

**RULE-22 | SLA | Vencimento marcado por Edge Function / RPC periódica**
- Where: `api.sla.verificarVencidos` + Edge Function `sla-marcar-vencidos` (cron 15min)
- `marcar_slas_vencidos(cliente_id)` atualiza `status='vencido'` e `violado=true` para SLAs onde `prazo_final < NOW()` e `status NOT IN ('concluido','vencido')`.
- Evidence type: Scheduled Edge Function + RPC
- Risk: Entre ciclos de 15min, SLAs vencidos aparecem como `pendente` — janela de 15min de stale data.
- Recommendation: Frontend usa `getSlaVisualStatus()` para cálculo visual em tempo real, compensando o gap.
- Priority: MEDIUM

**RULE-23 | SLA | Configuração por região sobrepõe padrão do cliente**
- Where: migration `20250311180000_sla_config_por_regiao.sql` + `sla_resolve_config()`
- `sla_config_regiao` permite prazos diferenciados por região. A função `sla_resolve_config()` aplica a config mais específica disponível: região > cliente > padrão global.
- Evidence type: DB table + RPC function
- Risk: Região sem config explícita silenciosamente usa o padrão do cliente.
- Recommendation: Expor no AdminSla quais regiões têm config personalizada vs herdada.
- Priority: MEDIUM

---

## ATENDIMENTO DO OPERADOR

**RULE-24 | Operador | Checkin GPS automático ao iniciar vistoria**
- Where: `VistoriaEtapa1Responsavel.tsx` + migration `20250311150000_levantamento_item_checkin.sql`
- Ao montar o formulário de vistoria (Etapa 1), `navigator.geolocation.getCurrentPosition` é chamado automaticamente (timeout 8s, maxAge 30s). Resultado gravado em `lat_chegada`, `lng_chegada`, `checkin_em`.
- Evidence type: `useEffect` com geolocation + `api.vistorias.create` / `api.itens.registrarCheckin`
- Risk: GPS pode falhar silenciosamente (timeout) — campo `checkin_em` fica null.
- Recommendation: Exibir aviso visual quando GPS não disponível; para motivo `recusa_entrada`, GPS é obrigatório (já validado em `VistoriaSemAcesso`).
- Priority: HIGH

**RULE-25 | Operador | Acesso negado: motivos rastreados e perfil do imóvel atualizado**
- Where: migration `20250318002000_vistoria_acesso_calhas.sql` + `VistoriaSemAcesso.tsx`
- Motivos válidos: `fechado_ausente`, `fechado_viagem`, `recusa_entrada`, `cachorro_bravo`, `calha_inacessivel`, `outro`.
- Vistoria criada com `acesso_realizado=false`, `status='revisita'`.
- Evidence type: DB CHECK constraint + TypeScript `MotivoSemAcesso` type
- Risk: Motivo `outro` sem campo de texto detalhado pode gerar dados analíticos pobres.
- Recommendation: Tornar `observacao_acesso` obrigatório quando `motivo_sem_acesso='outro'`.
- Priority: LOW

**RULE-26 | Operador | 3 tentativas sem acesso → prioridade_drone automática**
- Where: migration `20250318002000_vistoria_acesso_calhas.sql` trigger `trg_atualizar_perfil_imovel`
- O trigger conta vistorias com `acesso_realizado=false` para o mesmo imóvel. Ao atingir 3, seta `imoveis.prioridade_drone=true` automaticamente.
- Evidence type: DB trigger AFTER INSERT ON vistorias
- Risk: Contagem não tem janela temporal — 3 tentativas ao longo de meses têm o mesmo peso que 3 em uma semana.
- Recommendation: Adicionar janela de tempo (ex: últimos 60 dias) à contagem do trigger.
- Priority: MEDIUM

**RULE-27 | Operador | requer_notificacao_formal calculado pela view**
- Where: `v_imovel_historico_acesso` migration `20250318002000_vistoria_acesso_calhas.sql`
- Critério: `pct_sem_acesso > 80%` OU `proprietario_ausente=true`. Campo somente-leitura — nunca inserir manualmente.
- Evidence type: DB VIEW (read-only)
- Risk: View não tem índice — pode ser lenta em grandes volumes de imóveis.
- Recommendation: Considerar materializar ou adicionar coluna desnormalizada se performance degradar.
- Priority: LOW

**RULE-28 | Operador | Ciclos calculados: 6 por ano (bimestral)**
- Where: `CLAUDE.md` + `OperadorInicioTurno.tsx`
- Cálculo: `Math.ceil((new Date().getMonth() + 1) / 2)` — resultado 1–6.
- Evidence type: Frontend calculation
- Risk: Lógica de ciclo apenas no frontend — sem coluna `ciclo_calculado` no banco.
- Recommendation: Considerar persistir o ciclo no momento da criação da vistoria para evitar divergências retroativas.
- Priority: LOW

**RULE-29 | Operador | Depósitos PNCD: focos não podem exceder inspecionados**
- Where: `VistoriaEtapa3Inspecao.tsx`
- Para cada tipo de depósito (A1–E), `qtd_com_focos <= qtd_inspecionados` é validado no frontend.
- Evidence type: Frontend input constraint
- Risk: Sem constraint no banco — inserção direta pode violar a regra.
- Recommendation: Adicionar CHECK constraint `qtd_com_focos <= qtd_inspecionados` na tabela `vistoria_depositos`.
- Priority: MEDIUM

**RULE-30 | Operador | Calhas inacessíveis → calha_acessivel=false no perfil do imóvel**
- Where: `VistoriaEtapa3Inspecao.tsx` + `OperadorFormularioVistoria.tsx` handleFinalize
- Ao finalizar vistoria com calha inacessível, o sistema chama `api.imoveis.atualizarPerfil({ calha_acessivel: false })`.
- Evidence type: Frontend mutation on finalize
- Risk: Atualização do perfil pode falhar silenciosamente se a vistoria for salva offline.
- Recommendation: Incluir `calha_acessivel` no payload da operação `save_vistoria` do `offlineQueue`.
- Priority: MEDIUM

---

## FALSO POSITIVO

**RULE-31 | FalsoPositivo | Feedback de operador gravado em yolo_feedback**
- Where: migration (sprint 4 yolo_feedback) + `api.yoloFeedback.upsert` + `ItemDetailPanel.tsx`
- Campo `confirmado: boolean` — `true` = confirmado em campo, `false` = falso positivo. Um registro por item por cliente (upsert).
- Evidence type: DB table `yolo_feedback` com `UNIQUE(levantamento_item_id)` implícito + RLS por `cliente_id`
- Risk: Um operador pode marcar como falso positivo, outro confirmar — sem consenso.
- Recommendation: Considerar histórico de feedback (múltiplos registros por item) com timestamp para detectar conflitos.
- Priority: MEDIUM

**RULE-32 | FalsoPositivo | Feedback usado para re-treino do modelo YOLO**
- Where: migration yolo_feedback (comentário na tabela)
- `yolo_feedback` é designado para re-treino periódico do modelo — não tem impacto imediato no status do item.
- Evidence type: Table comment in SQL migration
- Risk: Pipeline de re-treino não está implementado no web — depende de processo externo Python.
- Recommendation: Expor no AdminIntegracoes um export de feedbacks para facilitar re-treino.
- Priority: LOW

---

## EVIDÊNCIA

**RULE-33 | Evidência | Imagens armazenadas no Cloudinary via Edge Function**
- Where: `api.cloudinary.uploadImage` + `src/services/api.ts`
- Upload de imagens para o Cloudinary é feito exclusivamente via Edge Function (Basic Auth), nunca com credenciais no frontend.
- Evidence type: `api.cloudinary.uploadImage(file, folder)` returning `{ secure_url, public_id }`
- Risk: Credenciais Cloudinary expostas se upload for feito client-side.
- Recommendation: Manter sempre via Edge Function — regra já implementada corretamente.
- Priority: CRITICAL

**RULE-34 | Evidência | Vínculo obrigatório: cliente → levantamento → item → imagem**
- Where: `CLAUDE.md` + migration `20250307120000_levantamento_item_evidencias.sql`
- Toda evidência (`levantamento_item_evidencias`) deve manter vínculo com `cliente_id`, `levantamento_id`, `levantamento_item_id`. Imagem no Cloudinary referenciada por `image_url` e `uuid_img` no item.
- Evidence type: FK constraints + RLS by `cliente_id`
- Risk: Imagens no Cloudinary sem referência no banco (orphan assets) se o INSERT falhar após upload.
- Recommendation: Implementar cleanup periódico de assets Cloudinary sem registro correspondente.
- Priority: MEDIUM

**RULE-35 | Evidência | Foto de imóvel sem acesso via upload externo**
- Where: `VistoriaSemAcesso.tsx` + `vistorias.foto_externa_url`
- Na vistoria sem acesso, o operador pode registrar foto da fachada. Upload via Edge Function — campo `foto_externa_url` (nullable).
- Evidence type: `api.cloudinary.uploadImage` + `vistorias.foto_externa_url` column
- Risk: URL externa sem controle de acesso pode expirar ou ser inválida.
- Recommendation: Considerar armazenar no mesmo Cloudinary folder das evidências de levantamento.
- Priority: LOW

---

## CRUZAMENTO CASO↔FOCO

**RULE-36 | CruzamentoCasoFoco | Executado EXCLUSIVAMENTE pelo trigger no banco**
- Where: `CLAUDE.md` + migration `20250318000000_centro_notificacoes.sql`
- Trigger `trg_cruzar_caso_focos` → função `fn_cruzar_caso_com_focos`. Nunca replicar essa lógica no frontend. `caso_foco_cruzamento` nunca deve ser inserido manualmente.
- Evidence type: CLAUDE.md regra crítica + DB trigger AFTER INSERT ON casos_notificados
- Risk: Desenvolvedores podem tentar replicar a lógica no frontend para otimização — isso criaria dados duplicados.
- Recommendation: Adicionar comment no `api.casosNotificados` alertando para nunca inserir em `caso_foco_cruzamento`.
- Priority: CRITICAL

**RULE-37 | CruzamentoCasoFoco | Raio de 300m via cálculo haversine (sem PostGIS)**
- Where: migration `20250318000000_centro_notificacoes.sql`
- O cruzamento usa fórmula haversine em PL/pgSQL puro (PostGIS não disponível). Índice em `(cliente_id, latitude, longitude)` para filtro de bbox antes do cálculo preciso.
- Evidence type: SQL function with haversine + spatial index
- Risk: Performance pode degradar com muitos levantamento_itens — haversine sem índice geométrico é O(n).
- Recommendation: Considerar habilitar PostGIS extension para usar `ST_DWithin` com índice GIST.
- Priority: MEDIUM

**RULE-38 | CruzamentoCasoFoco | Elevação de prioridade para Crítico ao cruzar**
- Where: migration `20250318000000_centro_notificacoes.sql` trigger
- Ao cruzar caso com foco, o trigger atualiza `levantamento_itens.prioridade = 'Crítico'` e grava no `payload` do item: `{ "caso_notificado_proximidade": "<caso_id>" }`.
- Evidence type: DB trigger UPDATE levantamento_itens
- Risk: Múltiplos casos próximos sobrescrevem o payload com apenas o último `caso_id`.
- Recommendation: Usar `jsonb_set` para acumular uma lista de caso_ids no payload, não sobrescrever.
- Priority: HIGH

**RULE-39 | CruzamentoCasoFoco | Alerta no ItemDetailPanel quando casos em 300m**
- Where: `ItemDetailPanel.tsx` + `api.casosNotificados.countProximoAoItem`
- Banner expansível exibido ao operador com: doença + data + distância para cada caso próximo. Usa RPC `contar_casos_proximos_ao_item(item_id)`.
- Evidence type: React component conditional render
- Risk: Exibição apenas — sem ação obrigatória do operador ao ver o banner.
- Recommendation: Considerar exigir confirmação explícita do operador ao resolver item com casos próximos.
- Priority: LOW

**RULE-40 | CruzamentoCasoFoco | LGPD: casos_notificados sem dados pessoais identificáveis**
- Where: `CLAUDE.md` + migration `20250318000000_centro_notificacoes.sql`
- A tabela `casos_notificados` armazena apenas: endereço, bairro, latitude, longitude, doença, status, data. NÃO armazena: nome, CPF, data de nascimento ou qualquer identificador direto do paciente.
- Evidence type: Table DDL (ausência de colunas PII) + CLAUDE.md rule
- Risk: Integrações futuras (e-SUS, SINAN) podem receber dados pessoais — necessário filtrar antes de persistir.
- Recommendation: `montarPayloadESUS()` em `src/lib/sinan.ts` já contempla isso — revisar antes de qualquer nova integração.
- Priority: CRITICAL

**RULE-41 | CruzamentoCasoFoco | Raio de sugestão de planejamento: 500m com ≥ 3 casos**
- Where: `AdminCasosNotificados.tsx`
- Quando ≥ 3 casos notificados no mesmo bairro em raio de 500m, o sistema exibe botão "Criar planejamento" para o gestor.
- Evidence type: Frontend logic in `AdminCasosNotificados.tsx`
- Risk: Lógica de clustering de 500m está apenas no frontend — sem persistência do cluster.
- Recommendation: Considerar materializar clusters em tabela ou view para uso em relatórios e histórico.
- Priority: LOW

---

## MULTITENANCY (transversal)

**RULE-42 | Multitenancy | Todo select/insert/update filtrado por cliente_id**
- Where: `CLAUDE.md` + todas as tabelas com RLS + `api.ts`
- Sem exceção. Toda query usa `.eq('cliente_id', clienteId)` ou join `!inner` para garantir isolamento.
- Evidence type: RLS policies em todas as tabelas + padrão de api.ts
- Risk: Queries sem `cliente_id` vazam dados entre prefeituras.
- Recommendation: Adicionar lint rule ou test que verifique ausência de queries sem filtro de cliente.
- Priority: CRITICAL

**RULE-43 | Multitenancy | clienteId obtido SEMPRE via useClienteAtivo hook**
- Where: `CLAUDE.md` + `src/hooks/useClienteAtivo.tsx`
- Em componentes e hooks, nunca hardcodar ou derivar `clienteId` diretamente — sempre `const { clienteId } = useClienteAtivo()`.
- Evidence type: Hook convention
- Risk: Desvios podem passar revisão de código e vazar dados.
- Recommendation: Criar ESLint custom rule para detectar acesso direto a `supabase` em componentes de página.
- Priority: HIGH
