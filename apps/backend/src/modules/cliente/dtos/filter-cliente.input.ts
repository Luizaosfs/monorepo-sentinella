import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterClienteSchema = z.object({
  nome: z
    .string()
    .describe('Filtrar por nome (busca parcial, case-insensitive)')
    .optional(),
  slug: z.string().describe('Filtrar por slug (busca parcial)').optional(),
  ativo: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .describe('Filtrar por status ativo/inativo')
    .optional(),
  uf: z
    .string()
    .length(2)
    .describe('Filtrar por sigla do estado (ex: SP)')
    .optional(),
  ibgeMunicipio: z
    .string()
    .describe('Filtrar por código IBGE do município')
    .optional(),
});

export class FilterClienteInput extends createZodDto(filterClienteSchema) {}
