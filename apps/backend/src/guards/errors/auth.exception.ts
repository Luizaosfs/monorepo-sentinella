import { createExceptionFactory } from '@/common/errors/exception-factory';

export const AuthException = createExceptionFactory({
  unauthorized: {
    type: 'unauthorized',
    message: 'Usuário não autorizado',
  },
  invalidCredentials: {
    type: 'unauthorized',
    message: 'Email ou senha inválidos',
  },
  inactiveUser: {
    type: 'forbidden',
    message: 'Usuário desativado. Contate o administrador.',
  },
  mustChangePassword: {
    type: 'forbidden',
    message: 'É necessário alterar a senha antes de continuar.',
  },
  notLinked: {
    type: 'forbidden',
    message: 'Usuário sem vínculo com identidade de autenticação. Contate o administrador.',
  },
});
