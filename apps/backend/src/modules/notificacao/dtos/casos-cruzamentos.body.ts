import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const listCasosPaginadoSchema = z.object({
  limit:         z.coerce.number().int().min(1).max(500).optional(),
  cursorCreated: z.string().optional(),
  cursorId:      z.string().uuid().optional(),
});
export class ListCasosPaginadoQuery extends createZodDto(listCasosPaginadoSchema) {}
export type ListCasosPaginadoInput = z.infer<typeof listCasosPaginadoSchema>;

export const listCasoIdsComCruzamentoSchema = z.object({
  casoIds: z.array(z.string().uuid()).min(1),
});
export class ListCasoIdsComCruzamentoBody extends createZodDto(listCasoIdsComCruzamentoSchema) {}
export type ListCasoIdsComCruzamentoInput = z.infer<typeof listCasoIdsComCruzamentoSchema>;
