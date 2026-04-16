import { createExceptionFactory } from '@/common/errors/exception-factory';

export const RiskEngineException = createExceptionFactory({
  /** Política de risco não encontrada */
  notFound: { type: 'notFound', message: 'Política de risco não encontrada' },
  /** Run não encontrada */
  runNotFound: { type: 'notFound', message: 'Run não encontrada' },
  /** Configuração de drone não encontrada */
  droneConfigNotFound: { type: 'notFound', message: 'Configuração de drone não encontrada para este cliente' },
  /** Classe YOLO não encontrada */
  yoloClassNotFound: { type: 'notFound', message: 'Classe YOLO não encontrada' },
  /** Sinônimo YOLO não encontrado */
  synonymNotFound: { type: 'notFound', message: 'Sinônimo YOLO não encontrado' },
});
