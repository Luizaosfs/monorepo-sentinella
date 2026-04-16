import { createExceptionFactory } from '@/common/errors/exception-factory';

export const CicloException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Ciclo não encontrado' },
  alreadyExists: {
    type: 'conflict',
    message: 'Já existe um ciclo com este número e ano para o cliente',
  },
  jaExisteAtivo: {
    type: 'conflict',
    message: 'Já existe um ciclo com status ativo para este cliente',
  },
  jaFechado: {
    type: 'conflict',
    message: 'Este ciclo já está fechado',
  },
});
