import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { positiveIntWithFallback } from './zod-coercion';

export const paginationSchema = z.object({
  currentPage: positiveIntWithFallback(1, { description: 'Página atual' }),
  perPage: positiveIntWithFallback(15, { max: 200, description: 'Itens por página' }),
  orderKey: z.string().default('created_at'),
  orderValue: z.enum(['asc', 'desc']).default('desc'),
});

export class PaginationProps extends createZodDto(paginationSchema) {}
