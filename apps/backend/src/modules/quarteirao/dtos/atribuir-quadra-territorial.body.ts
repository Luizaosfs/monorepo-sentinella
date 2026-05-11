import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const atribuirQuadraTerritorialSchema = z.object({
  quadraId: z.string().uuid('quadraId deve ser um UUID válido'),
  agenteId: z.string().uuid('agenteId deve ser um UUID válido'),
});

export class AtribuirQuadraTerritorialBody extends createZodDto(atribuirQuadraTerritorialSchema) {}
