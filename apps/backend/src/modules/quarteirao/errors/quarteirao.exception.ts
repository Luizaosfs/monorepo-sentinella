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
  invalidGeom: {
    type: 'badRequest',
    message: 'Polígono GeoJSON inválido (ST_IsValid falhou)',
  },
  geomOutsideRegiao: {
    type: 'badRequest',
    message: 'Polígono do quarteirão está fora dos limites da região',
  },
  geomOverlap: {
    type: 'conflict',
    message: 'Polígono se sobrepõe a um quarteirão já cadastrado neste cliente',
  },
  cicloFechado: {
    type: 'forbidden',
    message: 'Não é possível alterar distribuições de um ciclo fechado',
  },
  bulkInsertFailed: {
    type: 'unprocessableEntity',
    message: 'Falha ao gravar lote de quarteirões — nenhuma alteração foi salva',
  },
  upsertDistribuicaoFailed: {
    type: 'unprocessableEntity',
    message: 'Falha ao gravar atribuições — verifique os dados e tente novamente',
  },
});
