import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterPlanoAcaoSchema = z.object({
  clienteId: z
    .string()
    .uuid()
    .optional()
    .describe('Filtrar por cliente (admin via query)'),
  tipoItem: z.string().optional().describe('Filtrar por tipo de item de levantamento'),
});

export type FilterPlanoAcaoInput = z.infer<typeof filterPlanoAcaoSchema>;

export class FilterPlanoAcaoQuery extends createZodDto(filterPlanoAcaoSchema) {}

/** Mesmos filtros que a listagem padrão; rota `/all` só muda inclusão de inativos. */
export const filterPlanoAcaoAllSchema = filterPlanoAcaoSchema;
export type FilterPlanoAcaoAllInput = FilterPlanoAcaoInput;

export class FilterPlanoAcaoAllQuery extends createZodDto(filterPlanoAcaoAllSchema) {}
