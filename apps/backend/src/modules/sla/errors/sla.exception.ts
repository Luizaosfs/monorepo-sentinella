import { createExceptionFactory } from '@/common/errors/exception-factory';

export const SlaException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'SLA não encontrado' },
  jaNaPrioridadeMaxima: {
    type: 'conflict',
    message: 'Já está na prioridade máxima',
  },
  transicaoInvalida: {
    type: 'badRequest',
    message: 'Transição de status inválida',
  },
  configNotFound: {
    type: 'notFound',
    message: 'Configuração SLA não encontrada',
  },
  feriadoNotFound: { type: 'notFound', message: 'Feriado não encontrado' },
});
