import { createExceptionFactory } from '@/common/errors/exception-factory';

export const DroneException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Drone não encontrado' },
  vooNotFound: { type: 'notFound', message: 'Voo não encontrado' },
  pipelineNotFound: {
    type: 'notFound',
    message: 'Pipeline run não encontrada',
  },
});
