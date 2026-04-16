import { createExceptionFactory } from '@/common/errors/exception-factory';

export const UsuarioException = createExceptionFactory({
  /** Já existe um usuário com este email */
  emailAlreadyExists: {
    type: 'conflict',
    message: 'Já existe um usuário com este email',
  },
  /** Usuário não encontrado */
  notFound: { type: 'notFound', message: 'Usuário não encontrado' },
});
