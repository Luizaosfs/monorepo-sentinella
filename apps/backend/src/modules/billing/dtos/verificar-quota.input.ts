import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const verificarQuotaSchema = z.object({
  clienteId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do cliente (admin pode especificar; padrão: tenant do token)'),
  metrica: z
    .enum([
      'voos_mes',
      'levantamentos_mes',
      'itens_mes',
      'vistorias_mes',
      'usuarios_ativos',
      'ia_calls_mes',
      'storage_gb',
    ])
    .describe('Métrica a verificar'),
});

export class VerificarQuotaQuery extends createZodDto(verificarQuotaSchema) {}
