import { createExceptionFactory } from '@/common/errors/exception-factory';

export const VistoriaException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Vistoria não encontrada' },
  imovelRequired: {
    type: 'badRequest',
    message: 'Imóvel é obrigatório para este tipo de vistoria',
  },
});
