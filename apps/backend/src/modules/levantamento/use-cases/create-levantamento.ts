import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { VerificarQuota } from '../../billing/use-cases/verificar-quota';
import { QuotaException } from '../../billing/errors/quota.exception';
import { CreateLevantamentoBody } from '../dtos/create-levantamento.body';
import { Levantamento } from '../entities/levantamento';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class CreateLevantamento {
  constructor(
    private repository: LevantamentoWriteRepository,
    @Inject('REQUEST') private req: Request,
    private verificarQuota: VerificarQuota,
  ) {}

  async execute(input: CreateLevantamentoBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));

    const { ok, usado, limite, motivo } = await this.verificarQuota.execute(clienteId, { metrica: 'levantamentos_mes' });
    if (!ok) throw QuotaException.excedida({ metrica: 'levantamentos_mes', usado, limite, motivo });

    const levantamento = new Levantamento(
      {
        clienteId,
        usuarioId: this.req['user']?.id as string,
        cicloId: input.cicloId,
        observacao: input.observacao,
        statusProcessamento: 'aguardando',
        totalItens: 0,
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.repository.create(levantamento);
    return { levantamento: created };
  }
}
