import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterPluvioRunSchema = z.object({
  clienteId: z.string().uuid().optional(),
  status: z.string().optional(),
  dataReferenciaInicio: z.coerce.date().optional(),
  dataReferenciaFim: z.coerce.date().optional(),
});

export class FilterPluvioRunInput extends createZodDto(filterPluvioRunSchema) {}
export type FilterPluvioRunInputType = z.infer<typeof filterPluvioRunSchema>;
