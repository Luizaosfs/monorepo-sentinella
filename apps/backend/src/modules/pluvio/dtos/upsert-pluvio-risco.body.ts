import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const upsertPluvioRiscoSchema = z.object({
  id: z.string().uuid().optional(),
  regiaoId: z.string().uuid('regiaoId inválido'),
  nivel: z.string({ required_error: 'Nível obrigatório' }),
  precipitacaoAcumulada: z.number({ required_error: 'Precipitação acumulada obrigatória' }),
  dataReferencia: z.coerce.date({ required_error: 'Data de referência obrigatória' }),
  observacoes: z.string().optional(),
});

export class UpsertPluvioRiscoBody extends createZodDto(upsertPluvioRiscoSchema) {}
export type UpsertPluvioRiscoInput = z.infer<typeof upsertPluvioRiscoSchema>;
