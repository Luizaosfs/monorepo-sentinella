import { createExceptionFactory } from '@/common/errors/exception-factory';

export const ClienteException = createExceptionFactory({
  /** Cliente não encontrado */
  notFound: { type: 'notFound', message: 'Cliente não encontrado' },
  /** Já existe um cliente com este slug */
  slugAlreadyExists: {
    type: 'conflict',
    message: 'Já existe um cliente com este slug',
  },
  /** Hard delete LGPD — usar soft delete (C.5) */
  deleteBloqueado: {
    type: 'badRequest',
    message:
      'Cliente não pode ser apagado fisicamente. Use ativo=false + deleted_at=now() para desativar.',
  },
});
