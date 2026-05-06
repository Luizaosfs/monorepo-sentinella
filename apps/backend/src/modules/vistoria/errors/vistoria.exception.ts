import { createExceptionFactory } from '@/common/errors/exception-factory';

export const VistoriaException = createExceptionFactory({
  notFound: { type: 'notFound', message: 'Vistoria não encontrada' },
  imovelRequired: {
    type: 'badRequest',
    message: 'Imóvel é obrigatório para este tipo de vistoria',
  },
  semPermissao: {
    type: 'forbidden',
    message: 'Usuário sem permissão para esta operação',
  },
  focoStatusInvalido: {
    type: 'badRequest',
    message: 'Foco não está em inspeção — sem-acesso só pode ser registrado durante a inspeção',
  },
  /** Hard delete LGPD — usar soft delete (C.5) */
  deleteBloqueado: {
    type: 'badRequest',
    message:
      'Vistorias não podem ser apagadas. Use deleted_at=now() para inativação.',
  },
  agenteForaTenant: {
    type: 'forbidden',
    message: 'Agente não pertence ao mesmo cliente.',
  },
});
