import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const finalizarImportSchema = z.object({
  importados:    z.number().int().optional(),
  comErro:       z.number().int().optional(),
  ignorados:     z.number().int().optional(),
  duplicados:    z.number().int().optional(),
  geocodificados: z.number().int().optional(),
  geoFalhou:     z.number().int().optional(),
  erros:         z.any().optional(),
  status:        z.string().optional(),
});
export class FinalizarImportBody extends createZodDto(finalizarImportSchema) {}
export type FinalizarImportInput = z.infer<typeof finalizarImportSchema>;
