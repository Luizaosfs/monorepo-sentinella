import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createAgrupamentoSchema = z.object({
  nome: z.string({ required_error: 'nome obrigatório' }),
  tipo: z.string({ required_error: 'tipo obrigatório' }),
  uf:   z.string().length(2).optional(),
});
export class CreateAgrupamentoBody extends createZodDto(createAgrupamentoSchema) {}

export const updateAgrupamentoSchema = z.object({
  nome:  z.string().optional(),
  tipo:  z.string().optional(),
  uf:    z.string().length(2).optional(),
  ativo: z.boolean().optional(),
});
export class UpdateAgrupamentoBody extends createZodDto(updateAgrupamentoSchema) {}

export const addAgrupamentoClienteSchema = z.object({
  clienteId: z.string().uuid({ message: 'clienteId deve ser UUID válido' }),
});
export class AddAgrupamentoClienteBody extends createZodDto(addAgrupamentoClienteSchema) {}
