import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateFocoRiscoSchema = z.object({
  responsavel_id: z.string().uuid().optional(),
  desfecho: z.string().optional(),
  imovel_id: z.string().uuid().optional(),
  quadra_id: z.string().uuid().optional(),
  motivo_triagem: z.string().optional(),
});

export class UpdateFocoRiscoBody extends createZodDto(updateFocoRiscoSchema) {}
