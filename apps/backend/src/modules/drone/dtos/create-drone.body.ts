import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createDroneSchema = z.object({
  nome: z
    .string({ required_error: 'Nome obrigatório' })
    .describe('Nome do drone'),
  modelo: z.string().optional().describe('Modelo do drone'),
  serial: z.string().optional().describe('Número de série'),
  ativo: z.boolean().optional().default(true).describe('Drone ativo'),
});
export class CreateDroneBody extends createZodDto(createDroneSchema) {}

export const saveDroneSchema = z.object({
  nome: z.string().optional().describe('Nome do drone'),
  modelo: z.string().optional().describe('Modelo do drone'),
  serial: z.string().optional().describe('Número de série'),
  ativo: z.boolean().optional().describe('Drone ativo'),
});
export class SaveDroneBody extends createZodDto(saveDroneSchema) {}

export const createVooSchema = z.object({
  inicio: z.coerce.date({ required_error: 'Data/hora de início obrigatória' }).describe('Início do voo'),
  fim: z.coerce.date().optional().describe('Fim do voo'),
  planejamentoId: z.string().uuid().optional().describe('ID do planejamento'),
  pilotoId: z.string().uuid().optional().describe('ID do piloto'),
  duracaoMin: z.number().optional().describe('Duração em minutos'),
  km: z.number().optional().describe('Distância percorrida (km)'),
  ha: z.number().optional().describe('Área coberta (ha)'),
  baterias: z.number().int().optional().describe('Baterias utilizadas'),
  fotos: z.number().int().optional().describe('Fotos capturadas'),
});
export class CreateVooBody extends createZodDto(createVooSchema) {}

export const saveVooSchema = z.object({
  inicio: z.coerce.date().optional().describe('Início do voo'),
  fim: z.coerce.date().optional().describe('Fim do voo'),
  planejamentoId: z.string().uuid().optional().describe('ID do planejamento'),
  pilotoId: z.string().uuid().optional().describe('ID do piloto'),
});
export class SaveVooBody extends createZodDto(saveVooSchema) {}

export const createYoloFeedbackSchema = z.object({
  levantamentoItemId: z.string().uuid().describe('ID do item de levantamento'),
  confirmado: z.boolean().describe('Detecção confirmada'),
  observacao: z.string().optional().describe('Observações'),
});
export class CreateYoloFeedbackBody extends createZodDto(
  createYoloFeedbackSchema,
) {}
