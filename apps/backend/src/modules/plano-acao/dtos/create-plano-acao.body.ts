import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createPlanoAcaoSchema = z.object({
  label: z.string({ required_error: 'Label obrigatório' }).min(1),
  descricao: z.string().optional(),
  tipoItem: z.string().optional(),
  ativo: z.boolean().optional().default(true),
  ordem: z.coerce.number().int().optional().default(0),
  clienteId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do cliente (obrigatório para admin sem tenant na request)'),
});

export class CreatePlanoAcaoBody extends createZodDto(createPlanoAcaoSchema) {}
