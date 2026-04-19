import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const upsertIntegracaoSchema = z.object({
  tipo:              z.string({ required_error: 'tipo obrigatório' }),
  apiKey:            z.string({ required_error: 'apiKey obrigatório' }),
  endpointUrl:       z.string().url().optional(),
  codigoIbge:        z.string().optional(),
  unidadeSaudeCnes:  z.string().optional(),
  ambiente:          z.enum(['homologacao', 'producao']).optional(),
  ativo:             z.boolean().optional(),
});
export class UpsertIntegracaoBody extends createZodDto(upsertIntegracaoSchema) {}
export type UpsertIntegracaoInput = z.infer<typeof upsertIntegracaoSchema>;

export const updateIntegracaoMetaSchema = z.object({
  endpointUrl:       z.string().url().optional(),
  codigoIbge:        z.string().optional(),
  unidadeSaudeCnes:  z.string().optional(),
  ambiente:          z.enum(['homologacao', 'producao']).optional(),
  ativo:             z.boolean().optional(),
});
export class UpdateIntegracaoMetaBody extends createZodDto(updateIntegracaoMetaSchema) {}
export type UpdateIntegracaoMetaInput = z.infer<typeof updateIntegracaoMetaSchema>;
