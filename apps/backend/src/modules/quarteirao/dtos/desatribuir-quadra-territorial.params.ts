import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const desatribuirQuadraTerritorialSchema = z.object({
  quadraId: z.string().uuid('quadraId deve ser um UUID válido'),
});

export class DesatribuirQuadraTerritorialParams extends createZodDto(desatribuirQuadraTerritorialSchema) {}
