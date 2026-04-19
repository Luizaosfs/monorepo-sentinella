import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const findByEnderecoSchema = z.object({
  logradouro: z.string().min(1, 'logradouro obrigatório'),
  numero:     z.string().min(1, 'numero obrigatório'),
});

export type FindByEnderecoInput = z.infer<typeof findByEnderecoSchema>;
export class FindByEnderecoQuery extends createZodDto(findByEnderecoSchema) {}
