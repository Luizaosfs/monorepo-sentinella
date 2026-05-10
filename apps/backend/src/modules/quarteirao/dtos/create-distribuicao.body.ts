import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createDistribuicaoSchema = z.object({
  clienteId:  z.string().uuid().optional(),
  cicloId:    z.string().uuid(),
  quadraId:   z.string().uuid(),
  agenteId:   z.string().uuid(),
  bairroId:   z.string().uuid().optional(),
});

export class CreateDistribuicaoBody extends createZodDto(
  createDistribuicaoSchema,
) {}

export const copiarDistribuicaoSchema = z.object({
  cicloOrigemId:  z.string().uuid(),
  cicloDestinoId: z.string().uuid(),
  clienteId:      z.string().uuid().optional(),
});

export class CopiarDistribuicaoBody extends createZodDto(
  copiarDistribuicaoSchema,
) {}
