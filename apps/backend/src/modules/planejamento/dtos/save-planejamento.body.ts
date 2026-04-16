import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const savePlanejamentoSchema = z.object({
  descricao: z.string().optional().describe('Descrição do planejamento'),
  dataPlanejamento: z.coerce.date().optional().describe('Data do planejamento'),
  areaTotal: z.number().optional().describe('Área total em m²'),
  alturaVoo: z.number().optional().describe('Altura de voo em metros'),
  tipo: z.string().optional().describe('Tipo do planejamento'),
  ativo: z.boolean().optional().describe('Planejamento ativo'),
  tipoEntrada: z.string().optional().describe('Tipo de entrada'),
  tipoLevantamento: z
    .enum(['DRONE', 'MANUAL'])
    .optional()
    .describe('Tipo de levantamento'),
  regiaoId: z.string().uuid().optional().describe('ID da região'),
});

export class SavePlanejamentoBody extends createZodDto(
  savePlanejamentoSchema,
) {}
