import { createExceptionFactory } from '@/common/errors/exception-factory';

export const ImovelException = createExceptionFactory({
  /** Imóvel não encontrado */
  notFound: { type: 'notFound', message: 'Imóvel não encontrado' },
});
