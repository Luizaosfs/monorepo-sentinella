import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateItemSchema = z.object({
  item: z.string().optional(),
  risco: z.string().optional(),
  acao: z.string().optional(),
  prioridade: z.string().optional(),
  slaHoras: z.number().optional(),
  enderecoCurto: z.string().optional(),
  enderecoCompleto: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  maps: z.string().url().optional(),
  waze: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  imagePublicId: z.string().optional(),
  scoreFinal: z.number().min(0).max(1).optional(),
  peso: z.number().optional(),
});

export class UpdateItemBody extends createZodDto(updateItemSchema) {}
