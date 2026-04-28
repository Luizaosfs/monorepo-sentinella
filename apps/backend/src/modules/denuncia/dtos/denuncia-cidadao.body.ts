import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CLOUDINARY_URL_PATTERN =
  /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/.+/;

export const denunciaCidadaoSchema = z.object({
  slug: z.string().min(1).max(100),
  bairroId: z.string().uuid().nullish(),
  descricao: z.string().min(1).max(2000),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  fotoUrl: z.string().url().max(2048)
    .regex(CLOUDINARY_URL_PATTERN, 'fotoUrl deve apontar para Cloudinary')
    .nullish(),
  fotoPublicId: z.string().max(255).nullish(),
});

export class DenunciaCidadaoBody extends createZodDto(denunciaCidadaoSchema) {}
