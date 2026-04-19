import { createExceptionFactory } from '@/common/errors/exception-factory';

export const DroneException = createExceptionFactory({
  notFound:           { type: 'notFound',  message: 'Drone não encontrado' },
  vooNotFound:        { type: 'notFound',  message: 'Voo não encontrado' },
  pipelineNotFound:   { type: 'notFound',  message: 'Pipeline run não encontrada' },
  riskConfigNotFound: { type: 'notFound',  message: 'Configuração de risco não encontrada' },
  yoloClassNotFound:  { type: 'notFound',  message: 'Classe YOLO não encontrada' },
  synonymNotFound:    { type: 'notFound',  message: 'Sinônimo não encontrado' },
  forbidden:          { type: 'forbidden', message: 'Recurso não pertence ao tenant' },
});
