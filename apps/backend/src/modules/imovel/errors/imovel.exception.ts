import { createExceptionFactory } from '@/common/errors/exception-factory';

export const ImovelException = createExceptionFactory({
  /** Imóvel não encontrado */
  notFound: { type: 'notFound', message: 'Imóvel não encontrado' },
  /** Hard delete LGPD — usar soft delete quando há vistorias (C.5) */
  deleteBloqueado: {
    type: 'badRequest',
    message:
      'Imóvel com vistorias não pode ser apagado. Use deleted_at=now() para inativação.',
  },
});
