/**
 * sinan.ts — Integração com e-SUS Notifica (API REST — Ministério da Saúde)
 *
 * Fluxo:
 *  1. Prefeitura obtém credenciais via Portal de Serviços DATASUS
 *     (servicos-datasus.saude.gov.br)
 *  2. Admin configura as credenciais em /admin/integracoes
 *  3. Operador clica "Notificar ao e-SUS" em um item confirmado
 *  4. Este módulo monta o payload e envia via api.notificacoesESUS.enviar()
 *
 * Documentação: https://datasus.saude.gov.br/wp-content/uploads/2022/02/Manual-de-Utilizacao-da-API-e-Sus-Notifica.pdf
 * Terminologia CID-10: A90=dengue · A92.0=chikungunya · A92.8=zika
 */

import { AGRAVO_CID, type TipoAgravoESUS, type ESUSNotificaPayload } from '@/types/database';

/**
 * Calcula a semana epidemiológica (1-53) de uma data.
 *
 * Segue o calendário SVS/MS brasileiro:
 * - Semana começa no domingo e termina no sábado
 * - A semana 1 do ano é aquela que contém o dia 1 de janeiro
 *   (i.e., o domingo da semana que inclui 01/jan, que pode ser em dezembro do ano anterior)
 */
export function calcularSemanaEpidemiologica(dataISO: string): number {
  const date = new Date(dataISO + 'T12:00:00'); // meio-dia para evitar edge cases de timezone

  // Domingo da semana epidemiológica que contém a data
  const dayOfWeek = date.getDay(); // 0 = domingo
  const sundayOfWeek = new Date(date);
  sundayOfWeek.setDate(date.getDate() - dayOfWeek);

  // Domingo da semana epidemiológica 1: a semana que contém 01/jan
  const jan1 = new Date(date.getFullYear(), 0, 1, 12);
  const jan1DayOfWeek = jan1.getDay();
  const firstSunday = new Date(jan1);
  firstSunday.setDate(jan1.getDate() - jan1DayOfWeek);

  const diffMs = sundayOfWeek.getTime() - firstSunday.getTime();
  const weekNumber = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

  // Semana 0 significa que a data pertence à última semana do ano anterior
  if (weekNumber < 1) {
    return calcularSemanaEpidemiologica(`${date.getFullYear() - 1}-12-31`);
  }
  return weekNumber;
}

/**
 * Converte dados de um item de levantamento confirmado em payload e-SUS Notifica.
 *
 * G-02: campos obrigatórios adicionados conforme Manual de Utilização da API e-SUS Notifica:
 *  - dataInicioSintomas (obrigatório para dengue/chikungunya/zika)
 *  - municipioResidencia (codigoIbge do município — reutilizado como residência padrão)
 */
export function montarPayloadESUS(
  item: {
    endereco_completo?: string | null;
    endereco_curto?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    data_hora?: string | null;
    /** Data de início dos sintomas (ISO date). Obrigatório para notificação completa. */
    data_inicio_sintomas?: string | null;
  },
  codigoIbge: string,
  cnes: string,
  tipoAgravo: TipoAgravoESUS = 'dengue',
): ESUSNotificaPayload {
  const dataNotificacao = item.data_hora
    ? item.data_hora.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // G-02: data de início dos sintomas — fallback para dataNotificacao se ausente
  // (padrão conservador: assume mesmo dia da notificação, revisado pelo município)
  const dataInicioSintomas = item.data_inicio_sintomas?.slice(0, 10) ?? dataNotificacao;

  return {
    codigoMunicipio:       codigoIbge,
    codigoCnes:            cnes,
    dataNotificacao,
    dataInicioSintomas,
    municipioResidencia:   codigoIbge, // padrão: mesmo município da prefeitura
    semanaEpidemiologica:  calcularSemanaEpidemiologica(dataNotificacao),
    agravo:                AGRAVO_CID[tipoAgravo] as ESUSNotificaPayload['agravo'],
    classificacaoFinal:    2,   // 2 = suspeito (padrão conservador — revisado pelo município)
    criterioConfirmacao:   2,   // 2 = clínico-epidemiológico (inspeção de campo)
    logradouro: item.endereco_completo ?? item.endereco_curto ?? undefined,
    latitude:   item.latitude  ?? undefined,
    longitude:  item.longitude ?? undefined,
  };
}

/**
 * Valida se a integração está minimamente configurada para envio.
 */
export function validarConfiguracaoIntegracao(cfg: {
  api_key: string | null;
  codigo_ibge: string | null;
  unidade_saude_cnes: string | null;
  ativo: boolean;
}): { valida: boolean; erros: string[] } {
  const erros: string[] = [];
  if (!cfg.ativo)              erros.push('Integração está desativada.');
  if (!cfg.api_key)            erros.push('API Key não configurada.');
  if (!cfg.codigo_ibge)        erros.push('Código IBGE do município não configurado.');
  if (!cfg.unidade_saude_cnes) erros.push('CNES da unidade de saúde não configurado.');
  return { valida: erros.length === 0, erros };
}
