import { Injectable } from '@nestjs/common';

import { VerificarQuota } from '../../billing/use-cases/verificar-quota';
import { QuotaException } from '../../billing/errors/quota.exception';
import { CreateVooBody } from '../dtos/create-drone.body';
import { Voo } from '../entities/drone';
import { DroneWriteRepository } from '../repositories/drone-write.repository';

@Injectable()
export class CreateVoo {
  constructor(
    private repository: DroneWriteRepository,
    private verificarQuota: VerificarQuota,
  ) {}

  async execute(clienteId: string, input: CreateVooBody): Promise<{ voo: Voo }> {
    const { ok, usado, limite, motivo } = await this.verificarQuota.execute(clienteId, { metrica: 'voos_mes' });
    if (!ok) throw QuotaException.excedida({ metrica: 'voos_mes', usado, limite, motivo });

    const entity = new Voo(
      {
        inicio: input.inicio,
        fim: input.fim,
        planejamentoId: input.planejamentoId,
        pilotoId: input.pilotoId,
        duracaoMin: input.duracaoMin,
        km: input.km,
        ha: input.ha,
        baterias: input.baterias,
        fotos: input.fotos,
      },
      {},
    );
    const created = await this.repository.createVoo(entity);
    return { voo: created };
  }
}
