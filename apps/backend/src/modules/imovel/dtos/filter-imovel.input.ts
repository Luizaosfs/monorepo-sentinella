import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterImovelSchema = z.object({
  clienteId: z.string().uuid().describe('Filtrar por cliente').optional(),
  regiaoId: z.string().uuid().describe('Filtrar por região').optional(),
  bairro: z.string().describe('Filtrar por bairro (busca parcial)').optional(),
  tipoImovel: z.string().describe('Filtrar por tipo de imóvel').optional(),
  ativo: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .describe('Filtrar por status ativo')
    .optional(),
});

export class FilterImovelInput extends createZodDto(filterImovelSchema) {}
