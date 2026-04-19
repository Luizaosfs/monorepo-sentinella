import { z } from 'zod';

export const denunciaCidadaoSchema = z.object({
  slug: z.string().min(1).max(100),
  bairroId: z.string().uuid().optional(),
  descricao: z.string().min(1).max(2000),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  fotoUrl: z.string().url().max(2048).optional(),
  fotoPublicId: z.string().max(255).optional(),
});

export type DenunciaCidadaoBody = z.infer<typeof denunciaCidadaoSchema>;
