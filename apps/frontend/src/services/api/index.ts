/**
 * api/index.ts — Agregador: compõe o objeto `api` a partir dos módulos por domínio.
 *
 * Interface pública preservada: `import { api } from '@/services/api'`
 * Todos os módulos e métodos mantêm exatamente os mesmos nomes e assinaturas.
 */
import '@/lib/api-client-config';

// Domínios core
import { focosRisco } from './domains/focos-risco';
import { reinspecoes } from './domains/reinspecoes';
import { vistorias } from './domains/vistorias';
import { levantamentos, itens } from './domains/levantamentos';
import { operacoes, operacoesSla } from './domains/operacoes';
import { imoveis } from './domains/imoveis';
import { clientes, regioes } from './domains/clientes';
import { planejamentos, ciclos } from './domains/planejamentos';
import { usuarios } from './domains/usuarios';
import { planoAcaoCatalogo } from './domains/plano-acao';

// SLA
import {
  sla,
  slaFeriados,
  slaIminentes,
  slaConfig,
  slaConfigRegiao,
  slaErros,
  slaConfigAudit,
  slaInteligente,
} from './domains/sla';

// Dashboard / analytics
import {
  resumosDiarios,
  scoreSurto,
  dashboardAnalitico,
  central,
  executivo,
  eficacia,
  territorial,
  reincidencia,
  admin,
  piloto,
} from './domains/dashboard';

// Drones
import {
  drones,
  voos,
  pipeline,
  condicoesVoo,
  yoloFeedback,
  yoloClassConfig,
  yoloQualidade,
  droneRiskConfig,
} from './domains/drones';

// Notificações
import {
  casosNotificados,
  unidadesSaude,
  notificacoesESUS,
  pushSubscriptions,
  notificacaoFormal,
  canalCidadao,
} from './domains/notificacoes';

// Pluvio
import { pluvio, pluvioOperacional, pluvioRisco } from './domains/pluvio';

// Billing
import { billing, quotas } from './domains/billing';

// Quarteirões
import { quarteiroes, distribuicaoQuarteirao } from './domains/quarteiroes';

// Risk engine
import { riskPolicy, riskPolicyHeader, riskPolicyEditor, liraa, score } from './domains/risk-engine';

// Sistema / infra
import {
  systemHealth,
  importLog,
  cnesSync,
  offlineSyncLog,
  jobQueue,
  auditLog,
  alertasRetorno,
  historicoAtendimento,
} from './domains/sistema';

// Cloudinary
import { cloudinary, cloudinaryOrfaos } from './domains/cloudinary';

// IA
import { analiseIa, iaInsights, identifyLarva } from './domains/ia';

// Miscelâneos
import {
  tags,
  recorrencias,
  integracoes,
  agrupamentos,
  map,
  evidenciasItem,
  levantamentoItemEvidencias,
} from './domains/misc';

export const api = {
  // Core operacional
  focosRisco,
  reinspecoes,
  vistorias,
  levantamentos,
  itens,
  operacoes,
  operacoesSla,
  imoveis,
  clientes,
  regioes,
  planejamentos,
  ciclos,
  usuarios,
  planoAcaoCatalogo,

  // SLA
  sla,
  slaFeriados,
  slaIminentes,
  slaConfig,
  slaConfigRegiao,
  slaErros,
  slaConfigAudit,
  slaInteligente,

  // Dashboard / analytics
  resumosDiarios,
  scoreSurto,
  dashboardAnalitico,
  central,
  executivo,
  eficacia,
  reincidencia,
  admin,
  piloto,
  territorial,

  // Drones
  drones,
  voos,
  pipeline,
  condicoesVoo,
  yoloFeedback,
  yoloClassConfig,
  yoloQualidade,
  droneRiskConfig,

  // Notificações
  casosNotificados,
  unidadesSaude,
  notificacoesESUS,
  pushSubscriptions,
  notificacaoFormal,
  canalCidadao,

  // Pluvio
  pluvio,
  pluvioOperacional,
  pluvioRisco,

  // Billing
  billing,
  quotas,

  // Quarteirões
  quarteiroes,
  distribuicaoQuarteirao,

  // Risk engine
  riskPolicy,
  riskPolicyHeader,
  riskPolicyEditor,
  liraa,
  score,

  // Sistema / infra
  systemHealth,
  importLog,
  cnesSync,
  offlineSyncLog,
  jobQueue,
  auditLog,
  alertasRetorno,
  historicoAtendimento,

  // Cloudinary
  cloudinary,
  cloudinaryOrfaos,

  // IA
  analiseIa,
  iaInsights,
  identifyLarva,

  // Miscelâneos
  tags,
  recorrencias,
  integracoes,
  agrupamentos,
  map,
  evidenciasItem,
  levantamentoItemEvidencias,
};
