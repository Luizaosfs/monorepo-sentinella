import { createExceptionFactory } from '@/common/errors/exception-factory';

export const PluvioException = createExceptionFactory({
  /** Run não encontrada */
  runNotFound: { type: 'notFound', message: 'Run pluviométrica não encontrada' },
  /** Registro de risco não encontrado */
  notFound: { type: 'notFound', message: 'Registro pluviométrico não encontrado' },
  /** Item não encontrado */
  itemNotFound: { type: 'notFound', message: 'Item pluviométrico não encontrado' },
});
