import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const refreshSchema = z.object({
  refreshToken: z.string({ required_error: 'refreshToken é obrigatório' }).min(1).max(2048),
});

export class RefreshBody extends createZodDto(refreshSchema) {}
