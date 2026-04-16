import { createExceptionFactory } from '@/common/errors/exception-factory';

export const ImportLogException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Registro de importação não encontrado' },
  clienteIdRequired: {
    type: 'badRequest',
    message: 'Informe clienteId para registrar o log neste contexto',
  },
});
