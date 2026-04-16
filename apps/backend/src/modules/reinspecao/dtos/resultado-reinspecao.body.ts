import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const resultadoReinspecaoSchema = z.object({
  resultado: z.string().min(1, 'Resultado obrigatório'),
  dataRealizada: z.coerce.date().optional(),
});

export class ResultadoReinspecaoBody extends createZodDto(
  resultadoReinspecaoSchema,
) {}
