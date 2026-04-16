import { createExceptionFactory } from '@/common/errors/exception-factory';

export const QuarteiraoException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Quarteirão não encontrado' },
  distribuicaoNotFound: {
    type: 'notFound',
    message: 'Distribuição de quarteirão não encontrada',
  },
  conflict: {
    type: 'conflict',
    message: 'Já existe quarteirão com este código para o município',
  },
  conflictDistribuicao: {
    type: 'conflict',
    message:
      'Já existe distribuição para este quarteirão e ciclo neste município',
  },
  badRequest: {
    type: 'badRequest',
    message: 'Parâmetros inválidos para a operação',
  },
  forbiddenTenant: {
    type: 'forbidden',
    message: 'Acesso negado a este recurso',
  },
});
