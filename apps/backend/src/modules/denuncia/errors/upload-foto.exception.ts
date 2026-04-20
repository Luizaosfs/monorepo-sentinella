import { createExceptionFactory } from '@/common/errors/exception-factory';

export const UploadFotoException = createExceptionFactory({
  fileTooLarge: { type: 'badRequest', message: 'Arquivo maior que 8 MB' },
  invalidContentType: { type: 'badRequest', message: 'Tipo de arquivo não permitido' },
  uploadFailed: { type: 'internalServerError', message: 'Falha ao enviar a foto' },
});
