import { createExceptionFactory } from '@/common/errors/exception-factory';

export const OperacaoException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Operação não encontrada' },
  alreadyExists: {
    type: 'conflict',
    message: 'Já existe uma operação ativa para este item',
  },
  transicaoInvalida: {
    type: 'badRequest',
    message: 'Transição de status inválida',
  },
});
