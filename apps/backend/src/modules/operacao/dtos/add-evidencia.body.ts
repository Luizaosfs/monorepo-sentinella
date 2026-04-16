import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const addEvidenciaSchema = z.object({
  imageUrl: z
    .string()
    .url({ message: 'URL da imagem inválida' })
    .describe('URL da imagem'),
  legenda: z.string().optional().describe('Legenda da foto'),
  publicId: z.string().optional().describe('Public ID do Cloudinary'),
});

export class AddEvidenciaBody extends createZodDto(addEvidenciaSchema) {}
