import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** ID do foco vem da rota (`:id`). */
export const iniciarInspecaoSchema = z.object({
  observacao: z.string().optional(),
});

export type IniciarInspecaoInput = z.infer<typeof iniciarInspecaoSchema>;

export class IniciarInspecaoBody extends createZodDto(iniciarInspecaoSchema) {}
