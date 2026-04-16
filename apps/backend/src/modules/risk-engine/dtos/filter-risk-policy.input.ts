import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterRiskPolicySchema = z.object({
  clienteId: z.string().uuid().optional(),
  name: z.string().optional(),
  version: z.string().optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export class FilterRiskPolicyInput extends createZodDto(filterRiskPolicySchema) {}
export type FilterRiskPolicyInputType = z.infer<typeof filterRiskPolicySchema>;
