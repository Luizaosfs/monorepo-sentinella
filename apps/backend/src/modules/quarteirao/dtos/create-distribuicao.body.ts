import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createDistribuicaoSchema = z.object({
  clienteId: z.string().uuid().optional(),
  ciclo: z.coerce.number().int(),
  quarteirao: z.string().min(1, 'Quarteirão obrigatório'),
  agenteId: z.string().uuid(),
  regiaoId: z.string().uuid().optional(),
});

export class CreateDistribuicaoBody extends createZodDto(
  createDistribuicaoSchema,
) {}

export const copiarDistribuicaoSchema = z.object({
  cicloOrigem: z.coerce.number().int(),
  cicloDestino: z.coerce.number().int(),
  clienteId: z.string().uuid().optional(),
});

export class CopiarDistribuicaoBody extends createZodDto(
  copiarDistribuicaoSchema,
) {}
