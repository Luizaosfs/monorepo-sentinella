import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { SecurityEventType, SecuritySeverity } from '../security-log.types';

export const listSecurityLogsSchema = z.object({
  eventType: z.nativeEnum(SecurityEventType).optional(),
  severity: z.nativeEnum(SecuritySeverity).optional(),
  clienteId: z.string().uuid().optional(),
  userId: z.string().optional(),
  ip: z.string().optional(),
  /** ISO date — padrão: últimos 30 dias */
  de: z.coerce.date().optional(),
  /** ISO date — padrão: agora */
  ate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

export class ListSecurityLogsInput extends createZodDto(listSecurityLogsSchema) {}
export type ListSecurityLogsInputType = z.infer<typeof listSecurityLogsSchema>;
