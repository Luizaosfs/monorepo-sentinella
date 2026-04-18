import { createExceptionFactory } from '@/common/errors/exception-factory';

export const LevantamentoException = createExceptionFactory({
  /** Levantamento não encontrado */
  notFound: { type: 'notFound', message: 'Levantamento não encontrado' },
  /** Planejamento não encontrado */
  planejamentoNotFound: { type: 'notFound', message: 'Planejamento não encontrado' },
  /** Planejamento inativo */
  planejamentoInativo: { type: 'conflict', message: 'Planejamento não está ativo' },
  /** Item não encontrado */
  itemNotFound: { type: 'notFound', message: 'Item de levantamento não encontrado' },
});
