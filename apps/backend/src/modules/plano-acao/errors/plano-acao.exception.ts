import { createExceptionFactory } from '@/common/errors/exception-factory';

export const PlanoAcaoException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Plano de ação não encontrado' },
  tenantRequired: {
    type: 'forbidden',
    message: 'Informe clienteId na query (admin) ou use usuário vinculado ao município',
  },
});
