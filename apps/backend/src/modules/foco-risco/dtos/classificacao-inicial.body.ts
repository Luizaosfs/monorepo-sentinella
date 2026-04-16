import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const classificacaoInicialSchema = z.object({
  focoId: z.string().uuid({ message: 'focoId deve ser um UUID válido' }),
  classificacao: z.enum(['suspeito', 'risco', 'foco', 'caso_notificado'], {
    required_error: 'classificacao é obrigatório',
    invalid_type_error:
      'classificacao deve ser: suspeito | risco | foco | caso_notificado',
  }),
});

export type ClassificacaoInicialInput = z.infer<
  typeof classificacaoInicialSchema
>;

export class ClassificacaoInicialBody extends createZodDto(
  classificacaoInicialSchema,
) {}
