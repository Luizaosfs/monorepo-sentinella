import { ForbiddenException } from '@nestjs/common';

export interface QuotaExcedidaArgs {
  metrica: string;
  usado: number;
  limite: number | null;
  motivo?: string;
}

export class QuotaException {
  static excedida(args: QuotaExcedidaArgs) {
    const msg =
      args.motivo === 'tenant_bloqueado'
        ? 'Conta suspensa, cancelada ou trial expirado'
        : `Quota de ${args.metrica} excedida: ${args.usado}/${args.limite ?? '∞'}`;
    return new ForbiddenException(msg);
  }
}
