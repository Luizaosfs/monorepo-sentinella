import { jsonRecordOptional } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveRegiaoSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .describe('Nome da região')
    .optional(),
  tipo: z.string().describe('Tipo da região').optional(),
  cor: z.string().describe('Cor de exibição no mapa').optional(),
  geojson: jsonRecordOptional('GeoJSON da área da região'),
  ativo: z.boolean().describe('Ativa ou desativa a região').optional(),
});

export class SaveRegiaoBody extends createZodDto(saveRegiaoSchema) {}
