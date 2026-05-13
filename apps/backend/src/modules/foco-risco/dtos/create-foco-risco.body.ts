import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createFocoRiscoSchema = z.object({
  imovelId: z.string().uuid().describe('ID do imóvel').optional(),
  quadraId: z.string().uuid().describe('ID da quadra').optional(),
  regiaoId: z.string().uuid().describe('ID da região').optional(),
  origemTipo: z
    .string()
    .refine(v => v !== 'pluvio', {
      message: "origemTipo 'pluvio' não é permitido. Chuva é risco preventivo territorial — registre via módulo pluvio.",
    })
    .describe('Origem do foco (agente, drone, cidadao, vistoria, levantamento)'),
  origemLevantamentoItemId: z
    .string()
    .uuid()
    .describe('ID do item de levantamento de origem')
    .optional(),
  origemVistoriaId: z
    .string()
    .uuid()
    .describe('ID da vistoria de origem')
    .optional(),
  prioridade: z
    .enum(['P1', 'P2', 'P3', 'P4', 'P5'])
    .describe('Prioridade do foco')
    .optional(),
  latitude: z.number().describe('Latitude GPS').optional(),
  longitude: z.number().describe('Longitude GPS').optional(),
  enderecoNormalizado: z.string().describe('Endereço normalizado').optional(),
  responsavelId: z
    .string()
    .uuid()
    .describe('ID do agente responsável')
    .optional(),
  focoAnteriorId: z
    .string()
    .uuid()
    .describe('ID do foco anterior (recorrência)')
    .optional(),
  observacao: z.string().describe('Observações iniciais').optional(),
  motivoTriagem: z.string().describe('Motivo de triagem (preenchido pelo projeto Python/YOLO)').optional(),
  classificacaoInicial: z
    .string()
    .default('suspeito')
    .describe('Classificação inicial do foco'),
});

export class CreateFocoRiscoBody extends createZodDto(createFocoRiscoSchema) {}
