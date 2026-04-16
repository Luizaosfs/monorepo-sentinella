import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const savePlanoAcaoSchema = z.object({
  label: z.string().min(1).optional(),
  descricao: z.string().nullable().optional(),
  tipoItem: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
  ordem: z.coerce.number().int().optional(),
});

export class SavePlanoAcaoBody extends createZodDto(savePlanoAcaoSchema) {}
