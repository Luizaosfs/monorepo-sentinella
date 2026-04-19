import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const addItemEvidenciaSchema = z.object({
  url: z.string().url(),
  publicId: z.string().optional(),
  tipo: z.string().optional(),
  legenda: z.string().optional(),
});

export class AddItemEvidenciaBody extends createZodDto(addItemEvidenciaSchema) {}
