import { jsonRecordOptional } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveQuarteiraoSchema = z.object({
  codigo:   z.string().min(1).describe('Código do quarteirão').optional(),
  regiaoId: z.string().uuid().nullable().describe('ID da região/bairro').optional(),
  ativo:    z.boolean().describe('Ativa ou desativa o quarteirão').optional(),
  geojson:  jsonRecordOptional('GeoJSON do polígono (somente Polygon simples — MultiPolygon não suportado)'),
});

export type SaveQuarteiraoInput = z.infer<typeof saveQuarteiraoSchema>;
export class SaveQuarteiraoBody extends createZodDto(saveQuarteiraoSchema) {}
