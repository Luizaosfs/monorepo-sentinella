import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createReinspecaoSchema = z.object({
  clienteId: z.string().uuid().optional(),
  focoRiscoId: z.string().uuid(),
  dataPrevista: z.coerce.date(),
  tipo: z.string().optional(),
  responsavelId: z.string().uuid().optional(),
  observacao: z.string().optional(),
});

export class CreateReinspecaoBody extends createZodDto(createReinspecaoSchema) {}

export const cancelarReinspecaoSchema = z.object({
  motivoCancelamento: z.string().min(1, 'Motivo obrigatório'),
  canceladoPor: z.string().uuid().optional(),
});

export class CancelarReinspecaoBody extends createZodDto(
  cancelarReinspecaoSchema,
) {}
