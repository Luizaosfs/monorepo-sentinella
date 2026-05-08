import { createExceptionFactory } from '@/common/errors/exception-factory';

export const ImplantacaoException = createExceptionFactory({
  semCicloAtivo:    { type: 'badRequest', message: 'Nenhum ciclo ativo encontrado. Crie e ative um ciclo antes de iniciar a operação.' },
  semAgentes:       { type: 'badRequest', message: 'Nenhum agente ativo cadastrado para este município.' },
  semQuarteiroes:   { type: 'badRequest', message: 'Nenhum quarteirão cadastrado. Cadastre quarteirões antes de distribuir.' },
  semDistribuicao:  { type: 'badRequest', message: 'Nenhum quarteirão distribuído para agentes no ciclo ativo.' },
  semImoveis:       { type: 'badRequest', message: 'Nenhum imóvel cadastrado nos quarteirões distribuídos. Cadastre imóveis antes de gerar a operação inicial.' },
});
