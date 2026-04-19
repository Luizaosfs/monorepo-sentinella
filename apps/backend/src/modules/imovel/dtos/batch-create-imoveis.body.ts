import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const imovelRowSchema = z.object({
  regiaoId:            z.string().uuid().optional().nullable(),
  tipoImovel:          z.string().default('residencial'),
  logradouro:          z.string().optional().nullable(),
  numero:              z.string().optional().nullable(),
  complemento:         z.string().optional().nullable(),
  bairro:              z.string().optional().nullable(),
  quarteirao:          z.string().optional().nullable(),
  latitude:            z.number().optional().nullable(),
  longitude:           z.number().optional().nullable(),
  ativo:               z.boolean().default(true),
  proprietarioAusente: z.boolean().default(false),
  tipoAusencia:        z.string().optional().nullable(),
  contatoProprietario: z.string().optional().nullable(),
  temAnimalAgressivo:  z.boolean().default(false),
  historicoRecusa:     z.boolean().default(false),
  temCalha:            z.boolean().default(false),
  calhaAcessivel:      z.boolean().default(true),
  prioridadeDrone:     z.boolean().default(false),
  notificacaoFormalEm: z.string().optional().nullable(),
});

export const batchCreateImoveisSchema = z.object({
  registros: z.array(imovelRowSchema).min(1),
});

export type BatchCreateImoveisInput = z.infer<typeof batchCreateImoveisSchema>;
export class BatchCreateImoveisBody extends createZodDto(batchCreateImoveisSchema) {}
