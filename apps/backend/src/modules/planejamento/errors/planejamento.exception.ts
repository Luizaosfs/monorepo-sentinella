import { createExceptionFactory } from '@/common/errors/exception-factory';

export const PlanejamentoException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Planejamento não encontrado' },
});
