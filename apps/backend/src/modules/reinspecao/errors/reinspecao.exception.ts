import { createExceptionFactory } from '@/common/errors/exception-factory';

export const ReinspecaoException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Reinspeção não encontrada' },
  focoNaoEncontrado: {
    type: 'notFound',
    message: 'Foco de risco não encontrado para esta reinspeção',
  },
  badRequest: {
    type: 'badRequest',
    message: 'Operação não permitida para o status atual',
  },
  payloadInvalido: {
    type: 'badRequest',
    message: 'Dados incompletos ou inválidos para a operação',
  },
  forbiddenTenant: {
    type: 'forbidden',
    message: 'Acesso negado a este recurso',
  },
});
