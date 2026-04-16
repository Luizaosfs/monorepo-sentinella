import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** `em_inspecao` não pode ser escolhido aqui — usar PATCH .../iniciar-inspecao. */
export const transicionarFocoRiscoSchema = z.object({
  statusPara: z
    .enum([
      'em_triagem',
      'aguarda_inspecao',
      'confirmado',
      'em_tratamento',
      'resolvido',
      'descartado',
    ])
    .describe('Novo status do foco'),
  motivo: z
    .string()
    .describe('Motivo da transição (obrigatório para descarte)')
    .optional(),
  desfecho: z
    .string()
    .describe('Desfecho (obrigatório ao resolver)')
    .optional(),
});

export class TransicionarFocoRiscoBody extends createZodDto(
  transicionarFocoRiscoSchema,
) {}
