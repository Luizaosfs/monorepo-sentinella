import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createFeriadoSchema = z.object({
  data: z.coerce.date().describe('Data do feriado'),
  descricao: z
    .string({ required_error: 'Descrição obrigatória' })
    .describe('Descrição do feriado'),
  nacional: z.boolean().optional().default(false).describe('Feriado nacional'),
});

export class CreateFeriadoBody extends createZodDto(createFeriadoSchema) {}
