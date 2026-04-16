import { createExceptionFactory } from '@/common/errors/exception-factory';

export const BillingException = createExceptionFactory({
  planoNotFound: { type: 'notFound', message: 'Plano não encontrado' },
  clientePlanoNotFound: {
    type: 'notFound',
    message: 'Plano do cliente não encontrado',
  },
  cicloNotFound: {
    type: 'notFound',
    message: 'Ciclo de billing não encontrado',
  },
});
