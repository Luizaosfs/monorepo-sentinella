import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const uploadFotoDenunciaSchema = z.object({
  fileBase64: z
    .string({ required_error: 'fileBase64 é obrigatório' })
    .min(100, 'Arquivo muito pequeno ou inválido')
    .max(4_000_000, 'Arquivo maior que 3 MB'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({
      message: 'Tipo de arquivo não permitido. Use: image/jpeg, image/png ou image/webp',
    }),
  }),
  folder: z.literal('denuncias', {
    errorMap: () => ({ message: 'folder deve ser "denuncias"' }),
  }),
});

export class UploadFotoDenunciaBody extends createZodDto(uploadFotoDenunciaSchema) {}
