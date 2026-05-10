import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const gerarLoteQuarteiraoSchema = z
  .object({
    bairroId: z.string().uuid({ message: 'bairroId deve ser UUID válido' }),
    prefixo: z
      .string({ required_error: 'Prefixo obrigatório' })
      .trim()
      .min(1, 'Prefixo não pode ser vazio')
      .max(10, 'Prefixo máximo 10 caracteres')
      .regex(/^[A-Za-z0-9]+$/, 'Prefixo: apenas letras e números, sem espaços ou caracteres especiais')
      .transform((v) => v.toUpperCase()),
    numeroInicial: z
      .number({ required_error: 'Número inicial obrigatório' })
      .int('Deve ser inteiro')
      .min(1, 'Número inicial mínimo 1'),
    numeroFinal: z
      .number({ required_error: 'Número final obrigatório' })
      .int('Deve ser inteiro')
      .min(1, 'Número final mínimo 1'),
  })
  .refine((d) => d.numeroFinal >= d.numeroInicial, {
    message: 'numeroFinal deve ser maior ou igual a numeroInicial',
    path: ['numeroFinal'],
  })
  .refine((d) => d.numeroFinal - d.numeroInicial + 1 <= 300, {
    message: 'Máximo 300 quarteirões por lote',
    path: ['numeroFinal'],
  });

export type GerarLoteQuarteiraoInput = z.infer<typeof gerarLoteQuarteiraoSchema>;
export class GerarLoteQuarteiraoBody extends createZodDto(gerarLoteQuarteiraoSchema) {}
