import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const focoConfigItemSchema = z.object({
  fase: z
    .enum(['triagem', 'inspecao', 'confirmacao', 'tratamento'])
    .describe('Fase do foco de risco'),
  prazoMinutos: z
    .coerce.number()
    .int()
    .positive()
    .describe('Prazo em minutos'),
  ativo: z.boolean().optional().default(true).describe('Config ativa'),
});

export const saveFocoConfigSchema = z.object({
  configs: z
    .array(focoConfigItemSchema)
    .describe('Lista de configurações por fase'),
});

export class SaveFocoConfigBody extends createZodDto(saveFocoConfigSchema) {}
