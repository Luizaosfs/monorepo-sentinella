import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveCicloSchema = z.object({
  numero: z.number().int().min(1).max(6).optional(),
  ano: z.number().int().min(2020).max(2100).optional(),
  status: z.string().optional(),
  dataInicio: z.coerce
    .string()
    .transform((v) => new Date(v))
    .optional(),
  dataFimPrevista: z.coerce
    .string()
    .transform((v) => new Date(v))
    .optional(),
  observacaoAbertura: z.string().optional(),
  observacaoFechamento: z.string().optional(),
});

export class SaveCicloBody extends createZodDto(saveCicloSchema) {}
