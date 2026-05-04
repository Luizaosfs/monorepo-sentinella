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
  papelNaoDefinido: {
    type: 'forbidden',
    message: 'Usuário sem papel definido — acesso negado',
  },
  usuarioInativo: {
    type: 'forbidden',
    message: 'Usuário inativo — acesso negado',
  },
  apenasAgenteInicia: {
    type: 'forbidden',
    message: 'Apenas agentes podem iniciar inspeções',
  },
  semPermissaoTransicionar: {
    type: 'forbidden',
    message: 'Agente só pode transicionar focos atribuídos a si',
  },
});
