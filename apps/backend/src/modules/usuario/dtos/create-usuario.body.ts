import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createUsuarioSchema = z.object({
  nome: z
    .string({ required_error: 'Nome obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .describe('Nome completo do usuário'),
  email: z
    .string({ required_error: 'Email obrigatório' })
    .email('Email inválido')
    .describe('Email de acesso (login)'),
  senha: z
    .string({ required_error: 'Senha obrigatória' })
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .describe('Senha de acesso (mínimo 6 caracteres)'),
  clienteId: z
    .string()
    .uuid('clienteId inválido')
    .optional()
    .describe('ID do município/cliente ao qual o usuário pertence'),
  unidadeSaudeId: z
    .string()
    .uuid('unidadeSaudeId inválido')
    .optional()
    .describe('Unidade de saúde vinculada (obrigatória para notificador)'),
  papeis: z
    .array(
      z.enum([
        'admin',
        'supervisor',
        'agente',
        'notificador',
        'analista_regional',
      ]),
    )
    .min(1, 'É obrigatório informar ao menos um papel')
    .describe('Papéis do usuário (admin, supervisor, agente, notificador, analista_regional)'),
}).superRefine((data, ctx) => {
  if (data.papeis.includes('notificador') && !data.unidadeSaudeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['unidadeSaudeId'],
      message: 'Notificador exige uma unidade de saúde vinculada',
    });
  }
});

export class CreateUsuarioBody extends createZodDto(createUsuarioSchema) {}
