# FILE_MAP — Sentinella Web

Mapa de arquivos-chave do projeto. Consulte antes de criar qualquer tipo, hook ou método.

## Tipos e serviços centrais

| Arquivo | Responsabilidade |
|---|---|
| `src/types/database.ts` | Todos os tipos do domínio (LevantamentoItem, Planejamento, CasoNotificado…) |
| `src/types/sla.ts` | SlaOperacional, calcularSlaHoras(), SLA_RULES, getSlaVisualStatus() |
| `src/types/focoRisco.ts` | Constantes `COR_STATUS`, `LABEL_STATUS` usadas por StatusBadge e telas de gestão |
| `src/services/api.ts` | Camada única de acesso ao Supabase — todo select/insert/update aqui |
| `src/lib/queryConfig.ts` | Constantes STALE/GC para React Query — usar em todos os hooks |

## Libs utilitárias

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/seedDefaultRiskPolicy.ts` | Política de risco pluvial padrão (chuva, temperatura, vento, persistência) |
| `src/lib/seedDefaultSlaConfig.ts` | Configuração SLA padrão criada ao cadastrar novo cliente |
| `src/lib/seedDefaultDroneRiskConfig.ts` | Config de risco do drone (base_by_risco, priority_thresholds) |
| `src/lib/offlineQueue.ts` | Fila IndexedDB para operações offline (checkin, update_atendimento, save_vistoria) |
| `src/lib/webPush.ts` | Subscrição Web Push para alertas de SLA crítico |
| `src/lib/sinan.ts` | e-SUS Notifica: calcularSemanaEpidemiologica, montarPayloadESUS, validarConfiguracaoIntegracao |
| `src/lib/focosRiscoUtils.ts` | Helpers do módulo focos_risco: conversão status, buildFocoPath, avancarFocoAte |
| `src/lib/transicoesFoco.ts` | State machine de transições de focos_risco no frontend |
| `src/lib/mapStatusOperacional.ts` | `mapFocoToStatusOperacional` + `LABEL_STATUS_OPERACIONAL` — mapeamento 8→3 estados |
| `src/lib/slaInteligente.ts` | Helpers do SLA Inteligente: LABEL_STATUS_SLA_INT, LABEL_FASE_SLA, COR_STATUS_SLA_INT, formatarTempoMin(), SEVERIDADE_SLA_INT |
| `src/lib/slaInteligenteVisual.ts` | Re-exporta slaInteligente + PRIORIDADE_SLA_INT, DESTAQUE_LINHA_SLA, ICONE_SLA |
| `src/lib/pilotoEventos.ts` | `logEvento(tipo, clienteId, payload?)` fire-and-forget para instrumentação do piloto de IA |
| `src/lib/reportPdf.ts` | Geração de PDF de relatório de levantamento |
| `src/lib/slaPdf.ts` / `slaAuditPdf.ts` | PDFs de SLA e auditoria |
| `src/lib/notificacaoFormalPdf.ts` | Geração de PDF de protocolo de notificação formal |
| `src/lib/painelExecutivoPdf.ts` | Geração de PDF do painel executivo |

## Hooks globais

| Arquivo | Responsabilidade |
|---|---|
| `src/hooks/useClienteAtivo.tsx` | Hook central de multitenancy — sempre use para obter clienteId |
| `src/hooks/use-mobile.tsx` | `useIsMobile()` — breakpoint 768px. Importar de `@/hooks/use-mobile` |
| `src/hooks/useSlaAlerts.ts` | Alertas de SLA — detecta itens próximos do vencimento + Web Push |
| `src/hooks/useOfflineStatus.ts` | Detecta perda de conexão |
| `src/hooks/useOfflineQueue.ts` | Drena fila offline ao reconectar, exibe toasts |

## Hooks de query (src/hooks/queries/)

| Arquivo | Exports principais |
|---|---|
| `useFocosRisco.ts` | useFocosRisco(filtros) — paginação + staleTime SHORT |
| `useSlaInteligente.ts` | useSlaInteligente(), useSlaInteligenteCriticos(), useSlaInteligenteByFoco(focoId) |
| `useImoveisProblematicos.ts` | useImoveisProblematicos(clienteId) — view v_imovel_historico_acesso |
| `useImoveis.ts` | useImoveis, useCreateImovelMutation, useUpdateImovelMutation |
| `useVistorias.ts` | useVistorias, useVistoriaResumo, useCreate/Add mutations |
| `useCnesSyncControle.ts` | useCnesSyncControle(clienteId) polling 5s; useSincronizarCnesMutation() |
| `useReinspecoes.ts` | useReinspecoesByFoco, useReinspecoesPendentesAgente, useCountReinspecoesPendentes, mutations |
| `useFocosAtribuidos.ts` | useFocosAtribuidos(agenteId) — focos atribuídos ao agente logado |
| `useLiraa.ts` | useLiraa(ciclo?), useLiraaCiclos() — view v_liraa_quarteirao; classificarIIP(), COR_IIP, LABEL_IIP |
| `usePipelineRuns.ts` | usePipelineRuns(limit) refetch 30s, usePipelineRunAtivo() refetch 10s |
| `useEficaciaTratamento.ts` | useEficaciaTratamento() — view v_eficacia_tratamento; LABEL_DEPOSITO, DEPOSITO_ORDEM |
| `useScoreTerritorial.ts` | useScoreImovel, useScoreTopCriticos, useScoreBairros, useScoreConfig; COR_SCORE, LABEL_SCORE |
| `useCentralOperacional.ts` | useCentralKpis() refetch 60s, useImoveisParaHoje(limit) |
| `usePainelExecutivo.ts` | useExecutivoKpis, useExecutivoTendencia, useExecutivoCobertura, useCoberturaAgregada |
| `useReincidenciaInteligente.ts` | useImoveisReincidentes, useReincidenciaPorDeposito, useReincidenciaSazonalidade |
| `useBilling.ts` | usePlanos, useClientePlano, useBillingResumo, useBillingSnapshots |
| `useJobQueue.ts` | useJobQueue(filtros), useRetryJobMutation, useCancelJobMutation |
| `useSystemHealth.ts` | useSystemHealthLogs, useSystemAlerts, useTriggerHealthCheck |
| `useCicloAtivo.ts` | useCicloAtivo(clienteId), useProgressoCiclo, useHistoricoCiclos |
| `useAlertasRetorno.ts` | useAlertasRetorno — alertas de imóveis com retorno pendente |

## Páginas — Operador/Agente

| Arquivo | Rota |
|---|---|
| `src/pages/operador/OperadorInicioTurno.tsx` | `/operador/inicio` |
| `src/pages/operador/OperadorListaImoveis.tsx` | `/operador/imoveis` |
| `src/pages/operador/OperadorFormularioVistoria.tsx` | `/operador/vistoria/:imovelId` |
| `src/pages/operador/OperadorMapa.tsx` | Mapa com rota otimizada TSP |
| `src/pages/operador/OperadorRotaDiaria.tsx` | `/operador/rota-diaria` |
| `src/pages/agente/AgenteHoje.tsx` | `/agente/hoje` |
| `src/pages/agente/AgenteVistoria.tsx` | `/agente/vistoria/:imovelId` |
| `src/pages/agente/AgenteReinspecao.tsx` | `/agente/reinspecao/:reinspecaoId` |
| `src/pages/agente/FichaImovel360.tsx` | `/agente/imoveis/:id` |

## Páginas — Gestor/Supervisor

| Arquivo | Rota |
|---|---|
| `src/pages/gestor/CentralOperacional.tsx` | `/gestor/central` |
| `src/pages/gestor/GestorTriagem.tsx` | `/gestor/triagem` |
| `src/pages/gestor/GestorFocos.tsx` | `/gestor/focos` |
| `src/pages/gestor/GestorFocoDetalhe.tsx` | `/gestor/focos/:id` |
| `src/pages/gestor/GestorMapa.tsx` | `/gestor/mapa` |

## Páginas — Admin

| Arquivo | Rota |
|---|---|
| `src/pages/admin/PainelExecutivo.tsx` | `/admin/executivo` |
| `src/pages/admin/AdminGestaCiclos.tsx` | `/admin/ciclos` |
| `src/pages/admin/AdminReincidencia.tsx` | `/admin/reincidencia` |
| `src/pages/admin/AdminSaudeSistema.tsx` | `/admin/saude-sistema` |
| `src/pages/admin/AdminJobQueue.tsx` | `/admin/job-queue` |
| `src/pages/admin/AdminImportarImoveis.tsx` | `/admin/importar-imoveis` |
| `src/pages/admin/AdminPlatformDashboard.tsx` | `/admin/plataforma` |
| `src/pages/admin/AdminLiraa.tsx` | `/admin/liraa` |
| `src/pages/admin/AdminPipelineStatus.tsx` | `/admin/pipeline-status` |
| `src/pages/admin/AdminEficaciaTratamentos.tsx` | `/admin/eficacia-tratamentos` |
| `src/pages/admin/AdminDistribuicaoQuarteirao.tsx` | `/admin/distribuicao-quarteirao` |
| `src/pages/admin/AdminScoreSurto.tsx` | `/admin/score-surto` |
| `src/pages/admin/AdminProdutividadeAgentes.tsx` | `/admin/produtividade-agentes` |
| `src/pages/admin/AdminYoloQualidade.tsx` | `/admin/yolo-qualidade` |
| `src/pages/admin/AdminSupervisorTempoReal.tsx` | `/admin/supervisor-tempo-real` |
| `src/pages/admin/AdminScoreConfig.tsx` | `/admin/score-config` |
| `src/pages/admin/AdminSla.tsx` | `/admin/sla` |
| `src/pages/admin/AdminCasosNotificados.tsx` | `/admin/casos` |
| `src/pages/admin/AdminImoveisProblematicos.tsx` | `/admin/imoveis-problematicos` |
| `src/pages/admin/AdminIntegracoes.tsx` | `/admin/integracoes` |
| `src/pages/admin/AdminUnidadesSaude.tsx` | `/admin/unidades-saude` |
| `src/pages/admin/AdminPlanoAcaoCatalogo.tsx` | `/admin/plano-acao-catalogo` |
| `src/pages/admin/AdminSlaFeriados.tsx` | `/admin/sla-feriados` |
| `src/pages/admin/AdminMapaComparativo.tsx` | `/admin/mapa-comparativo` |
| `src/pages/admin/AdminHeatmapTemporal.tsx` | `/admin/heatmap-temporal` |
| `src/pages/admin/AdminCanalCidadao.tsx` | `/admin/canal-cidadao` |
| `src/pages/admin/AdminPainelMunicipios.tsx` | `/admin/painel-municipios` |

## Páginas — Notificador e Públicas

| Arquivo | Rota |
|---|---|
| `src/pages/notificador/NotificadorHome.tsx` | `/notificador` |
| `src/pages/notificador/NotificadorRegistroCaso.tsx` | `/notificador/registrar` |
| `src/pages/public/DenunciaCidadao.tsx` | `/denuncia/:slug/:bairroId` — sem auth |
| `src/pages/public/PortalDenuncia.tsx` | `/denuncia/:slug` |
| `src/pages/public/ConsultaProtocolo.tsx` | `/denuncia/consultar` |
| `src/pages/public/LandingPage.tsx` | `/` |
| `src/pages/public/MunicipioPublico.tsx` | `/municipio/:slug` |

## Componentes especializados

| Arquivo | Responsabilidade |
|---|---|
| `src/components/levantamentos/ItemDetailPanel.tsx` | Painel de detalhes do item — score YOLO, casos próximos, voz, falso positivo |
| `src/components/map-v3/HeatmapLayer.tsx` | Camada de heatmap Leaflet — reutilizar em todos os mapas |
| `src/components/vistoria/VistoriaEtapa1Responsavel.tsx` | GPS checkin + moradores + grupos vulneráveis + toggle acesso |
| `src/components/vistoria/VistoriaEtapa2Sintomas.tsx` | Sintomas (febre, manchas…) + banner caso suspeito |
| `src/components/vistoria/VistoriaEtapa3Inspecao.tsx` | Depósitos A1-E: qtd inspecionados + com focos + seção calhas |
| `src/components/vistoria/VistoriaEtapa4Tratamento.tsx` | Eliminação de focos + larvicida por depósito |
| `src/components/vistoria/VistoriaEtapa5Riscos.tsx` | Riscos sociais/sanitários/vetoriais + FINALIZAR |
| `src/components/vistoria/VistoriaSemAcesso.tsx` | Fluxo de registro de tentativa sem acesso |
| `src/components/vistoria/IdentificacaoLarvaIA.tsx` | UI para identificação de larvas por IA |
| `src/components/foco/ScoreBadge.tsx` | Badge de score territorial (score, classificacao, showScore, size) |
| `src/components/foco/ReinspecaoCard.tsx` | Card de reinspeção pendente/vencida com botão executar |
| `src/components/foco/ClassificacaoBadge.tsx` | Badge de classificação inicial do foco |
| `src/components/foco/DadosMinimosPainel.tsx` | Painel de completude de dados mínimos do foco |
| `src/components/foco/CicloBadge.tsx` | Badge de ciclo bimestral |
| `src/components/foco/ImovelReincidenciaCard.tsx` | Card de imóvel reincidente com histórico de ciclos |
| `src/components/dashboard/ResumoIAWidget.tsx` | Widget de resumo executivo diário com IA (badge "IA", cache ia_insights) |
| `src/components/dashboard/AgentesHojeWidget.tsx` | Widget de agentes em campo hoje — reutilizável |
| `src/components/dashboard/ScoreSurtoWidget.tsx` | Widget do dashboard para score de surto |
| `src/components/dashboard/ResumoDiarioWidget.tsx` | Widget do dashboard para resumo diário |
| `src/components/dashboard/CasosNotificadosWidget.tsx` | Widget para casos notificados |
| `src/components/dashboard/PluvioRiskWidget.tsx` | Widget de risco pluviométrico com alerta janela pós-chuva |
| `src/components/QuotaBanner.tsx` | Banner progressivo de quota (70%+) |
| `src/components/OfflineBanner.tsx` | Banner de modo offline com contagem de operações pendentes |

## Edge Functions (supabase/functions/)

| Função | Responsabilidade |
|---|---|
| `triagem-ia-pos-voo/` | Cluster + Claude Haiku + sumário executivo pós-voo |
| `sla-push-critico/` | Web Push para SLAs com ≤1h restante |
| `relatorio-semanal/` | Relatório HTML semanal via Resend (cron seg 8h UTC) |
| `identify-larva/` | Identificação de larvas por IA em vistoria_depositos |
| `resumo-diario/` | Gera resumos_diarios por cliente (cache ia_insights) |
| `cloudinary-cleanup-orfaos/` | Purga arquivos Cloudinary órfãos |
| `score-worker/` | Processa jobs de score territorial; BATCH_SIZE=50; retry backoff 5min |
| `notif-canal-cidadao/` | Web Push para gestor quando foco de origem_tipo='cidadao' é criado |
| `liraa-export/` | Boletim LIRAa em HTML imprimível (v_liraa_quarteirao) |
| `billing-snapshot/` | Snapshot mensal de uso por cliente (cron 1º dia do mês) |
| `cloudinary-upload-image/` | Upload de imagem para Cloudinary |
| `cloudinary-delete-image/` | Exclusão de imagem do Cloudinary |
| `criar-usuario/` | Criação de usuário Supabase Auth + registro em `usuarios` |
| `geocode-regioes/` | Geocodificação de regiões via Nominatim |
| `health-check/` | Verifica saúde do sistema, refresh MVs, purga logs (cron 30min) |
| `job-worker/` | Processa fila de jobs (round-robin por cliente) |
| `limpeza-retencao-logs/` | Executa fn_purge_expired_logs e fn_redact_sensitive_log_fields |
| `pluvio-risco-daily/` | Processamento diário de risco pluviométrico por região |
| `sla-marcar-vencidos/` | Marca SLAs vencidos (cron) |
| `upload-evidencia/` | Upload de evidência para Cloudinary com metadados |
| `cnes-sync/` | Sync CNES/DATASUS (cron 03h UTC ou manual por cliente_id) |

## Namespaces de api.ts

| Namespace | Métodos principais |
|---|---|
| `api.levantamentos` | list, updatePlanejamento |
| `api.itens` | listByLevantamento, listByCliente, listMapByCliente, updateAtendimento, registrarCheckin, listByClienteAndPeriod |
| `api.casosNotificados` | list, create, updateStatus, countProximoAoItem, listProximosAoPonto, cruzamentosDoItem |
| `api.unidadesSaude` | list, create, update |
| `api.yoloFeedback` | upsert, getByItem |
| `api.analiseIa` | getByLevantamento, triggerTriagem |
| `api.sla` | listByCliente, listForPanel, updateStatus, pendingCount, verificarVencidos, escalar, reabrir |
| `api.slaFeriados` | listByCliente, create, remove, seedNacionais |
| `api.slaConfigRegiao` | listByCliente, upsert, remove |
| `api.planoAcaoCatalogo` | listByCliente, listAllByCliente, create, update, remove |
| `api.imoveis` | list, create, update, listProblematicos, marcarPrioridadeDrone, atualizarPerfil, countPrioridadeDroneByCliente |
| `api.vistorias` | listByAgente, listByImovel, create, updateStatus, addDeposito, addSintomas, addRiscos, getResumoAgente, registrarSemAcesso, addCalha, listCalhas |
| `api.pluvio` | riscoByCliente, latestRunByCliente |
| `api.quotas` | byCliente, usoMensal, usoMensalAll, verificar, update |
| `api.pushSubscriptions` | upsert, listByCliente, removeByEndpoint |
| `api.drones` | list, create, update, remove |
| `api.voos` | listByCliente, create, update, remove |
| `api.usuarios` | listByCliente, listPapeis, update, updatePapel, remove |
| `api.integracoes` | getByCliente, upsert, testarConexao |
| `api.notificacoesESUS` | listByCliente, listByItem, enviar, descartar |
| `api.cnesSync` | sincronizarManual, listarControle, listarLog, emAndamento |
| `api.admin` | comparativoMunicipios |
| `api.focosRisco` | list, get, getById, historico, timeline, criar, transicionar, update, analytics, resumoRegional, byLevantamentoItem, contagemPorStatus |
| `api.slaInteligente` | listByCliente, listCriticos, getByFocoId |
| `api.liraa` | calcular, consumoLarvicida, listPorQuarteirao, listCiclosDisponiveis, exportarPdf |
| `api.pipeline` | listRuns, getRunAtivo |
| `api.eficacia` | listPorDeposito, listFocosResolvidos |
| `api.score` | getImovel, listTopCriticos, listBairros, getConfig, forcarRecalculo, upsertConfig |
| `api.central` | getKpis, listImoveisParaHoje |
| `api.quarteiroes` | list, create, update, remove |
| `api.distribuicaoQuarteirao` | listByCiclo, upsert, copiarCiclo, cobertura |
| `api.scoreSurto` | porRegiao |
| `api.yoloQualidade` | resumo |
| `api.resumosDiarios` | list, gerar |
| `api.iaInsights` | getResumo(clienteId), gerar(clienteId, forceRefresh?) |
| `api.notificacaoFormal` | gerarProtocolo |
| `api.alertasRetorno` | listByAgente, resolver |
| `api.auditLog` | list |
| `api.billing` | listPlanos, getClientePlano, updateClientePlano, listResumo, listSnapshots, getUltimoSnapshot, listCiclos, triggerSnapshot |
| `api.ciclos` | getCicloAtivo, getProgresso, listHistorico, abrir, fechar, copiarDistribuicao |
| `api.clientes` | list, listAll, getById, getConfig, create, update, resolverPorCoordenada |
| `api.cloudinary` | uploadImage, deleteImage |
| `api.cloudinaryOrfaos` | listar |
| `api.condicoesVoo` | avaliarByCliente |
| `api.droneRiskConfig` | getByCliente, update, listYoloClasses, updateYoloClass, listSynonyms, addSynonym, deleteSynonym |
| `api.evidenciasItem` | listByLevantamentoItem, add |
| `api.executivo` | getKpis, getTendencia, getCobertura, getBairrosVariacao, getComparativoCiclos |
| `api.historicoAtendimento` | listByClienteELocalizacao, listByCliente |
| `api.identifyLarva` | invoke |
| `api.importLog` | criar, finalizar, listarByCliente |
| `api.jobQueue` | enqueue, list, get, retry, cancel |
| `api.levantamentoItemEvidencias` | listByItem |
| `api.map` | fullDataByCliente, itemStatusesByCliente |
| `api.operacoes` | ensureEmAndamento, statsByCliente, criarParaItem, enviarEquipeParaItem, resolverItem, resolverStatusItem, listarComVinculos, salvar, remover, atualizarStatus, listByFoco, listOperadores, bulkInsert, listExistingItemIds |
| `api.planejamentos` | listByCliente, listAtivosByCliente, listAtivosManuaisByCliente, upsert, remove, voosByPlanejamento |
| `api.pluvioOperacional` | listItems, createRunGetId, listRuns, createRun, deleteRun, updateRunTotal, upsertItem, deleteItem, bulkInsertItems |
| `api.pluvioRisco` | listByRegioes, upsert, remove, bulkInsert |
| `api.recorrencias` | listAtivasByCliente, countAtivasByCliente, listItensByRecorrencia |
| `api.regioes` | listByCliente, listAll, create, update, remove, bulkInsert |
| `api.reincidencia` | listImoveisReincidentes, listPorDeposito, listSazonalidade, scoreImovel, historicoCiclosImovel |
| `api.reinspecoes` | listByFoco, getById, listPendentesAgente, listVencidasCliente, countPendentesAgente, criar, registrarResultado, cancelar, reagendar, marcarVencidas |
| `api.riskPolicy` | listByCliente, delete, listAllClienteIds |
| `api.riskPolicyEditor` | getDefaults, upsertDefaults, listBins, replaceBins, listFactors, replaceFactors, listAdjusts, replaceAdjusts, listRules, replaceRules, getFallbackRule, upsertFallbackRule, importAll |
| `api.slaConfig` | getByCliente, upsert |
| `api.slaConfigAudit` | listByCliente |
| `api.slaErros` | listByCliente |
| `api.slaIminentes` | listByCliente, countByCliente |
| `api.systemHealth` | listLogs, latestByServico, listAlerts, resolverAlerta, triggerHealthCheck |
| `api.tags` | list |
| `api.yoloClassConfig` | listByCliente |
