import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createQuarteiraoSchema = z.object({
  clienteId: z.string().uuid().optional(),
  codigo: z.string().min(1, 'Código obrigatório'),
  regiaoId: z.string().uuid().optional(),
  bairro: z.string().optional(),
  ativo: z.boolean().optional(),
});

export class CreateQuarteiraoBody extends createZodDto(createQuarteiraoSchema) {}
