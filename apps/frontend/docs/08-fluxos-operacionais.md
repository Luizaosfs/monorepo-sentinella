# 08 — Fluxos Operacionais

> **Para quem é este documento:** desenvolvedores, analistas e gestores que precisam entender o que acontece passo a passo em cada operação do sistema, quem faz o quê, quando o banco age automaticamente e onde pode haver falhas.

**Notação:**
- `[USUÁRIO]` — ação manual de um usuário
- `[SISTEMA]` — ação automática (trigger, edge function, react query)
- `[BANCO]` — trigger, constraint ou função PL/pgSQL
- `[TS]` — código TypeScript no frontend
- `⚠` — ponto frágil ou risco identificado

---

## Fluxo 1 — Operação por Drone (ponta a ponta)

**Atores:** Supervisor, Pipeline Python, Operador
**Entidades:** `planejamentos`, `levantamentos`, `levantamento_itens`, `focos_risco`, `sla_operacional`

```
1. [USUÁRIO - Supervisor] Cria planejamento tipo DRONE
   → Define região, bairro e data prevista
   → api.planejamentos.create()

2. [USUÁRIO - Supervisor] Cria levantamento vinculado ao planejamento
   → Seleciona planejamento ativo
   → api.levantamentos.*
   → [BANCO] UNIQUE (cliente_id, planejamento_id, data_voo, tipo_entrada)
     → Se já existir levantamento no dia, reusa o existente

3. [PIPELINE PYTHON - Externo] Executa o voo
   a. Captura imagens com o drone
   b. ExifTool extrai coordenadas GPS de cada imagem
   c. YOLO detecta focos suspeitos → score_final (0–1 ou 0–100)
   d. Upload de imagens para Cloudinary
   e. Chama RPC Supabase para inserir os resultados:
      → INSERT em levantamento_itens (tipo_entrada='DRONE')

4. [BANCO] Para cada levantamento_item inserido:
   a. trg_levantamento_item_criar_sla_auto
      → Verifica se prioridade é P1/P2/P3
      → Se sim: calcula prazo via sla_aplicar_fatores() + sla_horas_from_config()
      → Cria sla_operacional com prazo_inicio e prazo_final
   b. trg_levantamento_item_recorrencia
      → Busca itens no mesmo endereço ou raio 50m nos últimos 30 dias
      → Se encontrado: eleva prioridade para Urgente, recalcula SLA
   c. [BANCO] (via focos_risco) Nasce um focos_risco com:
      → status = 'suspeita'
      → origem_tipo = 'drone'
      → origem_levantamento_item_id = levantamento_item.id

5. ⚠ [AUSENTE] Não há status de processamento visível no frontend
   → Gestor não sabe se o pipeline terminou ou travou

6. [USUÁRIO - Gestor/Supervisor] Abre painel de levantamento
   → Vê itens com score YOLO, prioridade, SLA
   → [TS] normalizeScore() converte 0–100 para 0–1
   → Pode chamar triagem IA (opcional)

7. [USUÁRIO - Gestor] Aciona triagem IA pós-voo (opcional)
   → Clica em "Triagem IA" no painel do levantamento
   → api.analiseIa.triggerTriagem() → invoca Edge Function triagem-ia-pos-voo
   → [EDGE FUNCTION]
     a. Agrupa focos por grade 0.001° (~100m)
     b. Filtra itens com score < limiar (falsos positivos prováveis)
     c. Chama Claude Haiku com o agrupamento
     d. Claude retorna sumário executivo em português
     e. Persiste em levantamento_analise_ia

8. [USUÁRIO - Gestor] Revisa itens e pode:
   a. Marcar como "Não confirmado" → [TS] api.yoloFeedback.upsert() → tabela yolo_feedback
   b. Transicionar foco: suspeita → em_triagem → aguarda_inspecao → confirmado
      → [TS] api.focosRisco.transicionar()
      → [BANCO] fn_transicionar_foco() valida estado + grava histórico

9. [BANCO] Ao confirmar foco:
   → fn_iniciar_sla_ao_confirmar_foco()
   → focos_risco.confirmado_em = now()
   → SLA começa a contar

10. [SISTEMA - Edge Function sla-marcar-vencidos] (cron frequente)
    → Varre sla_operacional → marca vencidos que ultrapassaram prazo_final

11. [SISTEMA - Edge Function sla-push-critico] (cron a cada hora)
    → Busca SLAs com ≤1h restante
    → Envia Web Push para operadores/gestores com subscrição ativa

12. [USUÁRIO - Operador] Abre portal /operador/atendimento
    → Vê focos no status em_triagem/confirmado atribuídos a ele
    → Vê mapa com rota otimizada (TSP nearest-neighbor)

13. [USUÁRIO - Operador] Chega ao local
    → Faz checkin GPS → api.itens.registrarCheckin()
    → Pode ser offline → enfileira em IndexedDB

14. [USUÁRIO - Operador] Evidencia e resolve foco
    → Tira fotos → api.cloudinary.upload()
    → Seleciona plano de ação do catálogo
    → Transiciona: confirmado → em_tratamento → resolvido
    → api.focosRisco.transicionar()

15. [BANCO] Ao resolver foco:
    → fn_fechar_sla_ao_resolver_foco()
    → sla_operacional.status = 'concluido'
    → sla_operacional.concluido_em = now()
    → foco_risco_historico recebe entrada final
```

**Exceção — Falso positivo:**
- Em qualquer momento antes de confirmar: gestor clica "Não confirmado"
- `yolo_feedback` registra o feedback para re-treino futuro do YOLO
- Foco é transicionado para `descartado`

**Exceção — SLA vencido:**
- Gestor pode escalar: prioridade sobe um nível, novo prazo calculado
- `escalonado = true`, `prioridade_original` preservada para auditoria

---

## Fluxo 2 — Operação Manual

**Atores:** Supervisor, Operador
**Entidades:** `planejamentos`, `levantamentos`, `levantamento_itens`, `focos_risco`, `sla_operacional`

```
1. [USUÁRIO - Supervisor] Cria planejamento tipo MANUAL
   → api.planejamentos.create({ tipo_entrada: 'MANUAL' })

2. [USUÁRIO - Operador] Navega para /operador/novo-item-manual
   → Preenche formulário (endereço, tipo de problema, risco)
   → Geocodificação via Google Maps (componente inline)
   → api.itens.createManual() → chama RPC criar_levantamento_item_manual()

3. [BANCO] RPC criar_levantamento_item_manual():
   → Busca ou cria levantamento do dia para o planejamento
   → Insere levantamento_item com tipo_entrada='MANUAL', score_final=NULL
   → Triggers disparam igual ao fluxo Drone (SLA, recorrência)
   → focos_risco nasce com origem_tipo='manual'

4. [continua igual ao Fluxo Drone a partir do passo 8]
```

**Diferença principal vs. Drone:** não há score YOLO (exibe "Entrada manual"). O foco nasce diretamente em status `suspeita` e pode ser confirmado manualmente.

---

## Fluxo 3 — Vistoria Domiciliar (Agente de Endemias)

**Atores:** Agente, (Gestor para acompanhamento)
**Entidades:** `imoveis`, `vistorias`, `vistoria_depositos`, `vistoria_sintomas`, `vistoria_riscos`, `casos_notificados`

```
1. [USUÁRIO - Agente] Acessa /agente/hoje
   → Vê stats do ciclo atual (pendentes, visitados, cobertura %)
   → Seleciona tipo de atividade (Tratamento/Pesquisa/LIRAa/Ponto Estratégico)

2. [USUÁRIO - Agente] Navega para /operador/imoveis
   → Vê lista de imóveis com status (vermelho=pendente, verde=visitado,
     âmbar=revisita, cinza=fechado)
   → Filtro por rua/bairro/quarteirão
   → Pode cadastrar novo imóvel via dialog (+)

3. [USUÁRIO - Agente] Seleciona imóvel → /agente/vistoria/:imovelId

4. [ETAPA 1 — Responsável]
   → [SISTEMA] GPS checkin automático (lat_chegada, lng_chegada, checkin_em)
   → Conta moradores (+/- botões)
   → Toggles: grávidas / idosos / crianças < 7 anos
   → Toggle "Conseguiu entrar no imóvel?"
     → NÃO → [DESVIO] Fluxo "Sem Acesso" (ver abaixo)
     → SIM → continua

5. [ETAPA 2 — Sintomas]
   → Toggles: febre / manchas vermelhas / dor articulações / dor de cabeça
   → Contador: quantos moradores com sintomas
   → Se moradores_sintomas_qtd > 0: exibe banner "caso suspeito será criado"

6. [ETAPA 3 — Inspeção]
   → Para cada tipo de depósito PNCD (A1, A2, B, C, D1, D2, E):
     → Qtd inspecionados
     → Qtd com focos (limitado a ≤ inspecionados)
   → Seção Calhas:
     → Toggle tem_calha
     → Se sim: toggle calha_inacessivel + posição + condição + foco

7. [ETAPA 4 — Tratamento]
   → Apenas depósitos que tiveram focos (qtd_com_focos > 0)
   → Para cada: qtd_eliminados + toggle larvicida + qtd_larvicida_g

8. [ETAPA 5 — Riscos]
   → Riscos sociais (menor incapaz, idoso incapaz, dep. químico, risco alimentar, moradia)
   → Riscos sanitários (criadouro animais, lixo, resíduos)
   → Riscos vetoriais (acúmulo orgânico, animais com sinais, caixa destampada, outro_livre)
   → Campo de observações
   → Botão FINALIZAR

9. [BANCO] Ao finalizar (sequência de inserts):
   a. INSERT vistorias (status='visitado')
   b. INSERT vistoria_depositos (um por tipo com foco)
   c. INSERT vistoria_sintomas
      → [BANCO] trg_sintomas_para_caso: se moradores_sintomas_qtd > 0
        → INSERT casos_notificados (doenca='suspeito', sem PII)
        → gerou_caso_notificado_id = caso_id
      → [BANCO] trg_cruzar_caso_focos: busca focos em 300m
        → Eleva prioridade dos focos próximos para Crítico
   d. INSERT vistoria_riscos
   e. UPDATE imoveis (tem_calha, calha_acessivel) se calha foi inspecionada
   f. [BANCO] trg_atualizar_perfil_imovel: se acesso_realizado=true, reseta contador
      ⚠ (comportamento esperado — mas não documentado explicitamente)

10. [SISTEMA] Tela de confirmação → botão "Nova vistoria" ou "Voltar à lista"
```

**Fluxo "Sem Acesso" (desvio da Etapa 1):**
```
4a. [USUÁRIO - Agente] Toca "Não conseguiu entrar"
    → VistoriaSemAcesso.tsx abre

4b. Seleciona motivo (ícones visuais):
    fechado_ausente / fechado_viagem / recusa_entrada /
    cachorro_bravo / calha_inacessivel / outro

4c. Toggle "Calha visível de fora":
    → Se sim: posição + condição + presença de foco

4d. Seleciona horário sugerido de retorno (manhã/tarde/horário_comercial)

4e. Campo foto externa URL (opcional)

4f. Textarea de observação

4g. [BANCO] INSERT vistorias (acesso_realizado=false, status='revisita')
    → trg_atualizar_perfil_imovel:
      → Conta vistorias sem acesso para este imóvel
      → Se count >= 3:
        → UPDATE imoveis SET historico_recusa=true, prioridade_drone=true
        → ⚠ Sem janela temporal — conta desde sempre

4h. [SISTEMA] Se 3ª tentativa: toast especial informando drone será acionado
```

**Fluxo offline:**
```
Se sem conexão ao chegar na etapa 9:
→ Toda a sequência é serializada em IndexedDB como 'save_vistoria'
→ OfflineBanner exibe contagem de pendentes
→ Ao reconectar: useOfflineQueue drena em FIFO, reexecuta toda a sequência via RPC create_vistoria_completa
→ Idempotência garantida: UNIQUE(imovel_id, agente_id, ciclo, data_visita) protege contra duplicatas em retry (QW-05)
→ Evidências perdidas (assinatura ou foto) são marcadas em pendente_assinatura/pendente_foto
→ Toast de aviso (10s) e badge "Pendente" na lista de imóveis alertam o operador
→ Queries de vistoria são invalidadas imediatamente após drain
→ Toasts de progresso informam status
```

**Limitações conhecidas do modo offline (risco potencial, não corrigido):**
- `navigator.onLine = true` não garante acesso ao Supabase (captive portals, perda de pacotes)
- Sem retry backoff: falhas transitórias são retentadas apenas na próxima reconexão

---

## Fluxo 4 — Denúncia via Canal Cidadão

**Atores:** Cidadão (anônimo)
**Entidades:** `canal_cidadao`, `focos_risco` (após triagem)

```
1. [CIDADÃO] Escaneia QR code em poste/UBS/prefeitura

2. [SISTEMA] Abre /denuncia/:slug/:bairroId no browser
   → Não requer login
   → PublicLayout sem navegação admin

3. [USUÁRIO - Cidadão] Preenche formulário:
   → Descrição do problema
   → Endereço (campo texto)
   → Foto (opcional — upload via Cloudinary)
   → Confirmação de bairro (pré-preenchido pelo :bairroId na URL)

4. [TS] api.*.create() → chama RPC canal_cidadao_denunciar()
   → [BANCO] SECURITY DEFINER — opera sem auth.uid()
   → Valida slug → obtém cliente_id
   → INSERT canal_cidadao (sem vinculo a usuário autenticado)

5. ⚠ Sem rate limiting — cidadão pode enviar N denúncias seguidas

6. [USUÁRIO - Gestor] Abre AdminCanalCidadao.tsx
   → Vê lista de denúncias com endereço, descrição, data
   → Pode criar foco de risco a partir da denúncia:
     → [TS] api.focosRisco.create({ origem_tipo: 'cidadao', ... })
     → [BANCO] focos_risco nasce com status='suspeita'

7. [Continua igual ao Fluxo Drone a partir do passo 8]
```

---

## Fluxo 5 — Risco Pluviométrico

**Atores:** Sistema (automático), Gestor
**Entidades:** `pluvio_risco_runs`, `pluvio_operacional_item`, `sla_operacional`, `focos_risco`

```
1. [SISTEMA - Edge Function pluvio-risco-daily] (cron diário)
   → Busca dados de chuva por bairro (API climática)
   → Para cada bairro:
     a. Calcula score de risco considerando:
        - chuva_mm (volume nas últimas 24h)
        - dias_sem_chuva (janela pós-chuva — larvas em desenvolvimento ativo)
        - temperatura (ótimo 25–30°C)
        - vento (redutor acima de 13 km/h)
        - persistencia_7d (dias consecutivos com chuva relevante)
        - tendencia (crescente/estável/decrescente)
     b. Classifica: Baixo / Médio / Alto / Muito Alto
     c. INSERT pluvio_operacional_item

2. [BANCO] Para itens com classificação Alta ou Muito Alta:
   → Trigger cria sla_operacional (item_id = pluvio_operacional_item.id)
   → Aplica fatores climáticos ao prazo:
     - Muito Alto: −30%
     - Persistência > 3 dias: −20%
     - Temperatura > 30°C: −10%

3. [SISTEMA] Dashboard atualiza PluvioRiskWidget
   → Mostra score por bairro
   → Se 3–6 dias após chuva intensa: exibe banner âmbar "Janela crítica"
   → Botão "Criar planejamento" pré-preenchido com a região de risco

4. [USUÁRIO - Gestor] Vê AdminPluvioOperacional (1.088 linhas)
   → Mapa de calor por bairro
   → Lista de bairros com SLA ativo
   → Pode criar planejamento preventivo diretamente

5. [BANCO] Se foco de risco com origem 'pluvio' for necessário:
   → Gestor cria manualmente ou via ação do painel
   → focos_risco nasce com origem_tipo='pluvio'

6. [Continua igual ao Fluxo Drone a partir do atendimento pelo operador]
```

**Janela crítica explicada:**
- Larvas do *Aedes aegypti* levam 3–6 dias para se desenvolver após a chuva
- Agir nessa janela elimina o mosquito antes de se tornar adulto
- Agir antes (durante a chuva) ou depois (>6 dias) tem menor impacto

---

## Fluxo 6 — Notificação de Caso de Dengue

**Atores:** Notificador (UBS/UPA/hospital), Sistema
**Entidades:** `casos_notificados`, `caso_foco_cruzamento`, `levantamento_itens`

```
1. [USUÁRIO - Notificador] Acessa /notificador/registrar

2. [USUÁRIO - Notificador] Preenche formulário:
   → Seleciona unidade de saúde (própria ou outra)
   → Tipo de doença: dengue / chikungunya / zika / suspeito
   → Status: suspeito / confirmado / descartado
   → Data de início dos sintomas
   → Endereço de residência do paciente (sem nome, sem CPF — LGPD)
   → Geocodificação do endereço via Google Maps
   → Observações (campo livre)

3. [TS] api.casosNotificados.create()
   → INSERT casos_notificados

4. [BANCO] fn_cruzar_caso_com_focos (PostGIS):
   → ST_DWithin(caso.geom, item.geom, 300) — busca focos em 300m
   → Para cada foco encontrado:
     a. INSERT caso_foco_cruzamento (caso_id, levantamento_item_id, distancia_metros)
     b. UPDATE levantamento_itens SET prioridade='Crítico'
     c. UPDATE focos_risco SET casos_ids = array_append(casos_ids, caso_id)

5. [SISTEMA] Dashboard CasosNotificadosWidget atualiza
   → Exibe count de confirmados, suspeitos, focos cruzados

6. [SISTEMA] ItemDetailPanel (quando operador abrir o foco):
   → Banner vermelho expansível "X casos em 300m"
   → Lista: doença + data + distância

7. [USUÁRIO - Gestor] Pode confirmar ou descartar casos via AdminCasosNotificados

8. [USUÁRIO - Gestor] Pode enviar caso confirmado ao e-SUS Notifica (opcional):
   → Botão "Notificar ao e-SUS" em ItemDetailPanel
   → api.notificacoesESUS.enviar()
   → Chama integração e-SUS Notifica com payload montado por sinan.ts
   → Registra em item_notificacoes_esus
```

---

## Fluxo 7 — Gestão de SLA (visão do gestor)

**Atores:** Gestor/Supervisor, Sistema
**Entidades:** `sla_operacional`, `focos_risco`

```
1. [SISTEMA - cron frequente] sla-marcar-vencidos Edge Function
   → marcar_slas_vencidos() → UPDATE status='vencido', violado=true

2. [SISTEMA - cron horário] sla-push-critico Edge Function
   → Busca SLAs com prazo_final BETWEEN now() AND now() + '1 hour'
   → Para cada um: envia Web Push às subscrições ativas do cliente
   ⚠ Não funciona em iOS Safari (limitação de plataforma)

3. [USUÁRIO - Gestor] AdminSla.tsx (764 linhas)
   → Painel com filtros por status/prioridade/período/operador
   → Cards de KPI: total, pendentes, vencidos, concluídos
   → Timeline de auditoria por foco (criado→atendimento→resolução)
   → ⚠ Esta página acessa supabase diretamente (violação do padrão api.ts)

4. [USUÁRIO - Gestor] Escalar SLA vencido:
   → Botão "Escalar" no painel
   → api.sla.escalar(slaId)
   → [BANCO] escalar_sla_operacional():
     a. escalar_prioridade(prioridade_atual) → próximo nível
     b. Recalcula sla_horas + novo prazo_final
     c. prioridade_original preservada (auditoria)
     d. escalonado=true, escalonado_em=now()

5. [USUÁRIO - Gestor] Reabrir SLA concluído indevidamente:
   → api.sla.reabrir(slaId)
   → Status volta para 'em_atendimento'
```

---

## Fluxo 8 — Sync CNES (Unidades de Saúde)

**Atores:** Sistema (automático), Supervisor (manual)

```
1. [SISTEMA - cron 3h UTC] Edge Function cnes-sync
   → Para cada cliente com uf + ibge_municipio configurados:
     a. Chama API CNES/DATASUS
     b. Retry 3x com backoff exponencial em caso de falha
     c. Para cada unidade retornada:
        → Se existe (por CNES): UPDATE dados
        → Se não existe: INSERT (origem='cnes')
        → Se tinha mas sumiu: UPDATE ativo=false (nunca DELETE)
     d. Unidades com origem='manual' e cnes=NULL: NUNCA inativadas
     e. Registra resultado linha a linha em unidades_saude_sync_log

2. [USUÁRIO - Supervisor] AdminUnidadesSaude.tsx
   → Vê painel CNES: status, última execução, totais inseridos/atualizados/inativos
   → Pode clicar "Sincronizar agora" (sync manual do cliente atual)
   → api.cnesSync.sincronizarManual()
   → [BANCO] useCnesSyncControle polling 5s durante sincronização

3. [SISTEMA] Se cliente sem uf/ibge_municipio configurado:
   → Painel exibe aviso "Configuração faltando"
   → Sync não é executado para este cliente
   → ⚠ Falha silenciosa no cron agendado (não há alerta automático ao gestor)
```

---

## Fluxo 9 — Onboarding de Novo Cliente

**Ator:** Admin da plataforma

```
1. [USUÁRIO - Admin] AdminClientes.tsx
   → Cria novo cliente (prefeitura):
     → Nome, CNPJ, UF, Código IBGE (7 dígitos)
     → UF + IBGE são necessários para CNES sync

2. [SISTEMA] Seeds automáticos executados pelo frontend:
   → seedDefaultRiskPolicy(clienteId)    — política de risco pluvial padrão
   → seedDefaultSlaConfig(clienteId)     — configuração SLA padrão
   → seedDefaultDroneRiskConfig(clienteId) — config de risco do drone

3. [USUÁRIO - Admin] Cria usuários e atribui papéis:
   → AdminUsuarios.tsx → api.usuarios.*
   → Convite por email (Supabase Auth)

4. [USUÁRIO - Supervisor (novo)] Configura a prefeitura:
   → AdminRegioes → cria regiões/bairros
   → AdminPlanejamentos → cria primeiros planejamentos
   → AdminSla → ajusta feriados e configs de SLA

⚠ Não existe wizard guiado de onboarding — cada passo é manual e separado
```

---

## Fluxo 10 — Relatório Semanal

**Ator:** Sistema (automático)

```
1. [SISTEMA - cron segunda-feira 8h UTC] Edge Function relatorio-semanal
   → Para cada cliente ativo:
     a. Coleta KPIs da semana:
        - Focos identificados (drone + manual + cidadão)
        - Focos resolvidos
        - Taxa de resolução
        - SLAs cumpridos / violados
        - Casos notificados
     b. Gera HTML do relatório
     c. Envia por email via Resend API para o email do supervisor
   → ⚠ Se RESEND_API_KEY não estiver configurada, falha silenciosamente
```

---

## Pontos frágeis transversais identificados nos fluxos

| Ponto | Fluxo afetado | Risco |
|-------|---------------|-------|
| Sem status de processamento do pipeline drone | Fluxo 1 | Gestor não sabe se processamento terminou ou travou |
| Canal Cidadão sem rate limiting | Fluxo 4 | Flood de denúncias falsas |
| ~~Bug payload JSONB em surtos~~ | ~~Fluxo 6~~ | ~~Perde referência de múltiplos casos no mesmo foco~~ ✅ Resolvido (ADR-QW03) |
| Cron CNES sem alerta em caso de falha | Fluxo 8 | Dados de unidades desatualizados sem aviso |
| Onboarding não guiado | Fluxo 9 | Erro de configuração (ex: sem IBGE) quebra funcionalidades silenciosamente |
| AdminSla acessa banco diretamente | Fluxo 7 | Fora do padrão, sem garantia de filtro por cliente |
| Web Push não funciona iOS | Todos com alerta | Operadores Apple não recebem alertas críticos |
| Janela de 30d da recorrência não configurável | Fluxo 1/2 | Municípios com padrão diferente não têm flexibilidade |
| 3 tentativas sem janela temporal | Fluxo 3 | Imóvel marcado para drone mesmo anos depois |

---

*Documento baseado no código-fonte real. Versão 2.1.0, análise em 2026-03-26.*
