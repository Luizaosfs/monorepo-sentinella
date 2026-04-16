import { jsonRecordOptional } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createRegiaoSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .describe('Nome da região'),
  tipo: z
    .string()
    .describe('Tipo da região (ex: bairro, setor, zona)')
    .optional(),
  cor: z.string().describe('Cor de exibição no mapa (hex ou nome)').optional(),
  geojson: jsonRecordOptional('GeoJSON da área da região'),
});

export class CreateRegiaoBody extends createZodDto(createRegiaoSchema) {}
