import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const criarItemManualSchema = z.object({
  planejamentoId: z.string().uuid({ message: 'planejamentoId deve ser UUID válido' }),
  dataVoo: z.coerce.date({ required_error: 'dataVoo é obrigatório' }),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  item: z.string().optional(),
  risco: z.string().optional(),
  acao: z.string().optional(),
  scoreFinal: z.number().int().optional(),
  prioridade: z.string().optional(),
  slaHoras: z.number().int().optional(),
  enderecoCurto: z.string().optional(),
  enderecoCompleto: z.string().optional(),
  imageUrl: z.string().optional(),
  maps: z.string().optional(),
  waze: z.string().optional(),
  dataHora: z.coerce.date().optional(),
  tags: z.array(z.string()).optional(),
  peso: z.number().int().optional(),
  payload: z.record(z.unknown()).optional(),
  imagePublicId: z.string().optional(),
});

export class CriarItemManualBody extends createZodDto(criarItemManualSchema) {}
