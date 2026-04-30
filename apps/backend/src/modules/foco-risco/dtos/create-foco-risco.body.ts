import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createFocoRiscoSchema = z.object({
  imovelId: z.string().uuid().describe('ID do imóvel').optional(),
  regiaoId: z.string().uuid().describe('ID da região').optional(),
  origemTipo: z
    .string()
    .describe('Origem do foco (levantamento, vistoria, cidadao, drone)'),
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
  classificacaoInicial: z
    .string()
    .default('suspeito')
    .describe('Classificação inicial do foco'),
});

export class CreateFocoRiscoBody extends createZodDto(createFocoRiscoSchema) {}
