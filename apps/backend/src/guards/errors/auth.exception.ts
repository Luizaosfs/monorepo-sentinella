import { createExceptionFactory } from '@/common/errors/exception-factory';

export const AuthException = createExceptionFactory({
  unauthorized: {
    type: 'unauthorized',
    message: 'Sessão inválida ou expirada. Faça login novamente.',
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
  refreshTokenInvalid: {
    type: 'unauthorized',
    message: 'Sua sessão expirou ou foi encerrada (login em outro dispositivo, troca de senha, ou inatividade prolongada). Faça login novamente.',
  },
  refreshTokenAlreadyUsed: {
    type: 'unauthorized',
    message: 'Esta sessão já foi renovada em outro lugar. Faça login novamente para continuar.',
  },
  refreshTokenRevoked: {
    type: 'unauthorized',
    message: 'Sua sessão foi encerrada (logout em outro dispositivo ou troca de senha). Faça login novamente.',
  },
  refreshTokenExpired: {
    type: 'unauthorized',
    message: 'Sua sessão expirou após 30 dias de inatividade. Faça login novamente.',
  },
  accessDenied: {
    type: 'forbidden',
    message: 'Acesso negado. Você não tem permissão para esta ação.',
  },
});
