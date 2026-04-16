import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const refreshSchema = z.object({
  refreshToken: z.string({ required_error: 'refreshToken é obrigatório' }),
});

export class RefreshBody extends createZodDto(refreshSchema) {}
