import { createExceptionFactory } from '@/common/errors/exception-factory';

export const FocoRiscoException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Foco de risco não encontrado' },
  transicaoInvalida: {
    type: 'badRequest',
    message: 'Transição de status inválida para o estado atual do foco',
  },
  statusInvalido: {
    type: 'badRequest',
    message: 'Status inválido para esta operação',
  },
  inicioInspecaoSemResponsavel: {
    type: 'badRequest',
    message: 'Atribua um agente responsável antes de iniciar a inspeção',
  },
  inicioInspecaoApenasResponsavel: {
    type: 'forbidden',
    message: 'Apenas o agente responsável pode iniciar a inspeção neste foco',
  },
});
