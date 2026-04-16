import { createExceptionFactory } from '@/common/errors/exception-factory';

export const RegiaoException = createExceptionFactory({
  /** Região não encontrada */
  notFound: { type: 'notFound', message: 'Região não encontrada' },
});
