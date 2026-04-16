import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const reagendarReinspecaoSchema = z.object({
  dataPrevista: z.coerce.date(),
});

export class ReagendarReinspecaoBody extends createZodDto(
  reagendarReinspecaoSchema,
) {}
