import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createImportLogSchema = z.object({
  clienteId: z
    .string()
    .uuid()
    .describe('Obrigatório para admin quando não há tenant na requisição')
    .optional(),
  filename: z.string().min(1, 'Nome do arquivo é obrigatório'),
  totalLinhas: z.coerce.number().int().min(0).default(0),
  importados: z.coerce.number().int().min(0).default(0),
  comErro: z.coerce.number().int().min(0).default(0),
  ignorados: z.coerce.number().int().min(0).default(0),
  duplicados: z.coerce.number().int().min(0).default(0),
  geocodificados: z.coerce.number().int().min(0).default(0),
  geoFalhou: z.coerce.number().int().min(0).default(0),
  status: z.enum(['em_andamento', 'concluido', 'erro']).default('em_andamento'),
  erros: z
    .union([z.record(z.string(), z.unknown()), z.array(z.unknown())])
    .optional()
    .describe('Detalhes de erros (JSON)'),
  finishedAt: z.coerce.date().optional(),
});

export class CreateImportLogBody extends createZodDto(createImportLogSchema) {}
