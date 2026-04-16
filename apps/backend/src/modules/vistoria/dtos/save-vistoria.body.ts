import { coerceOptionalNumber } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const jsonRecord = z.record(z.string(), z.unknown());

export const saveVistoriaSchema = z.object({
  agenteId: z.string().uuid().optional().describe('ID do agente responsável'),
  status: z.string().optional().describe('Status da vistoria'),
  dataVisita: z.coerce
    .date()
    .optional()
    .describe('Data/hora da visita (data_visita)'),
  moradoresQtd: z.coerce.number().int().optional().describe('Qtd de moradores'),
  gravidas: z.boolean().optional().describe('Há gestantes no imóvel'),
  idosos: z.boolean().optional().describe('Há idosos no imóvel'),
  criancas7anos: z
    .boolean()
    .optional()
    .describe('Há crianças menores de 7 anos'),
  latChegada: coerceOptionalNumber('Latitude de chegada'),
  lngChegada: coerceOptionalNumber('Longitude de chegada'),
  checkinEm: z.coerce.date().optional().describe('Momento do check-in'),
  observacao: z.string().optional().describe('Observações gerais'),
  payload: jsonRecord.optional().describe('Payload JSON auxiliar'),
  acessoRealizado: z
    .boolean()
    .optional()
    .describe('Acesso ao imóvel foi realizado'),
  motivoSemAcesso: z
    .string()
    .optional()
    .describe('Motivo pelo qual não houve acesso'),
  proximoHorarioSugerido: z
    .string()
    .optional()
    .describe('Horário sugerido pelo morador'),
  observacaoAcesso: z.string().optional().describe('Observação sobre o acesso'),
  fotoExternaUrl: z.string().url().optional().describe('URL da foto externa'),
  origemVisita: z.string().optional().describe('Origem da visita'),
  habitatSelecionado: z.string().optional().describe('Habitat selecionado'),
  condicaoHabitat: z.string().optional().describe('Condição do habitat'),
  assinaturaResponsavelUrl: z
    .string()
    .url()
    .optional()
    .describe('URL da assinatura do responsável'),
  pendenteAssinatura: z.boolean().optional().describe('Aguarda assinatura'),
  pendenteFoto: z.boolean().optional().describe('Aguarda foto externa'),
  origemOffline: z.boolean().optional().describe('Registro feito offline'),
  assinaturaPublicId: z
    .string()
    .optional()
    .describe('Public ID Cloudinary da assinatura'),
  fotoExternaPublicId: z
    .string()
    .optional()
    .describe('Public ID Cloudinary da foto externa'),
  idempotencyKey: z
    .string()
    .uuid()
    .optional()
    .describe('Chave de idempotência (UUID)'),
  focoRiscoId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe('Vínculo com foco de risco'),
  resultadoOperacional: z.string().optional().describe('Resultado operacional'),
  vulnerabilidadeDomiciliar: z
    .string()
    .optional()
    .describe('Vulnerabilidade domiciliar'),
  alertaSaude: z.string().optional().describe('Alerta de saúde'),
  riscoSocioambiental: z.string().optional().describe('Risco socioambiental'),
  riscoVetorial: z.string().optional().describe('Risco vetorial'),
  prioridadeFinal: z.string().optional().describe('Prioridade consolidada'),
  prioridadeMotivo: z.string().optional().describe('Motivo da prioridade'),
  dimensaoDominante: z
    .string()
    .optional()
    .describe('Dimensão dominante na consolidação'),
  consolidacaoResumo: z
    .string()
    .optional()
    .describe('Resumo textual da consolidação'),
  consolidacaoJson: jsonRecord
    .optional()
    .describe('JSON de consolidação analítica'),
  consolidacaoIncompleta: z
    .boolean()
    .optional()
    .describe('Consolidação incompleta'),
  versaoRegraConsolidacao: z
    .string()
    .optional()
    .describe('Versão da regra de consolidação'),
  versaoPesosConsolidacao: z
    .string()
    .optional()
    .describe('Versão dos pesos de consolidação'),
  consolidadoEm: z.coerce.date().optional().describe('Quando foi consolidado'),
  reprocessadoEm: z.coerce.date().optional().describe('Último reprocessamento'),
  reprocessadoPor: z
    .string()
    .uuid()
    .optional()
    .describe('Usuário que reprocessou'),
});

export class SaveVistoriaBody extends createZodDto(saveVistoriaSchema) {}
