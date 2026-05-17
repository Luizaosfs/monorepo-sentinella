import { createExceptionFactory } from '@/common/errors/exception-factory';

export const UsuarioException = createExceptionFactory({
  /** Já existe um usuário com este email */
  emailAlreadyExists: {
    type: 'conflict',
    message: 'Já existe um usuário com este email',
  },
  /** Usuário não encontrado */
  notFound: { type: 'notFound', message: 'Usuário não encontrado' },
  /** Unidade de saúde inválida ou de outro cliente */
  unidadeSaudeInvalida: {
    type: 'badRequest',
    message: 'Unidade de saúde inválida ou não pertence a este cliente',
  },
  /** Notificador exige unidade de saúde vinculada */
  unidadeSaudeObrigatoria: {
    type: 'badRequest',
    message: 'Notificador exige uma unidade de saúde vinculada',
  },
});
