import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const denunciaCidadaoSchema = z.object({
  slug: z.string().min(1).max(100),
  bairroId: z.string().uuid().nullish(),
  descricao: z.string().min(1).max(2000),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  fotoUrl: z.string().url().max(2048)
    .refine(u => u.startsWith('https://res.cloudinary.com/'), 'fotoUrl deve ser URL do Cloudinary')
    .nullish(),
  fotoPublicId: z.string().max(255).nullish(),
});

export class DenunciaCidadaoBody extends createZodDto(denunciaCidadaoSchema) {}
