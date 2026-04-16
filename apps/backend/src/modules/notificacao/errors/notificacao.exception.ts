import { createExceptionFactory } from '@/common/errors/exception-factory';

export const NotificacaoException = createExceptionFactory({
  unidadeNotFound: {
    type: 'notFound',
    message: 'Unidade de saúde não encontrada',
  },
  casoNotFound: { type: 'notFound', message: 'Caso notificado não encontrado' },
  pushNotFound: {
    type: 'notFound',
    message: 'Subscription de push não encontrada',
  },
  esusNotFound: {
    type: 'notFound',
    message: 'Notificação e-SUS não encontrada',
  },
});
