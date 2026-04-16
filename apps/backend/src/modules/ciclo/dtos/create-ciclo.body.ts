import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createCicloSchema = z.object({
  numero: z.number().int().min(1).max(6).describe('Número do bimestre (1-6)'),
  ano: z.number().int().min(2020).max(2100).describe('Ano do ciclo'),
  dataInicio: z.coerce
    .string()
    .transform((v) => new Date(v))
    .describe('Data de início do ciclo'),
  dataFimPrevista: z.coerce
    .string()
    .transform((v) => new Date(v))
    .describe('Data de término prevista do ciclo'),
  status: z.string().default('planejamento').optional(),
  observacaoAbertura: z.string().optional(),
});

export class CreateCicloBody extends createZodDto(createCicloSchema) {}
