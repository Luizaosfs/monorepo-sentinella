import { createExceptionFactory } from '@/common/errors/exception-factory';

export const ClienteException = createExceptionFactory({
  /** Cliente não encontrado */
  notFound: { type: 'notFound', message: 'Cliente não encontrado' },
  /** Já existe um cliente com este slug */
  slugAlreadyExists: {
    type: 'conflict',
    message: 'Já existe um cliente com este slug',
  },
});
