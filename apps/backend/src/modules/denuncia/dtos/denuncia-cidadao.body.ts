import { z } from 'zod';

export const denunciaCidadaoSchema = z.object({
  slug: z.string().min(1),
  bairroId: z.string().uuid().optional(),
  descricao: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  fotoUrl: z.string().url().optional(),
  fotoPublicId: z.string().optional(),
});

export type DenunciaCidadaoBody = z.infer<typeof denunciaCidadaoSchema>;
