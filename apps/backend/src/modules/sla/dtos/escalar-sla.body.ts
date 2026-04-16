import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const escalarSlaSchema = z.object({
  motivo: z.string().optional().describe('Motivo do escalamento'),
});

export class EscalarSlaBody extends createZodDto(escalarSlaSchema) {}
