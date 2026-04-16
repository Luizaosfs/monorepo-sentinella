import { Injectable } from '@nestjs/common';

import { CicloReadRepository } from '../repositories/ciclo-read.repository';
import { CicloViewModel } from '../view-model/ciclo';

@Injectable()
export class GetCicloAtivo {
  constructor(private repository: CicloReadRepository) {}

  async execute(clienteId: string) {
    const ciclo = await this.repository.findAtivo(clienteId);

    // Bimestre efetivo pelo calendário (Jan-Feb=1, Mar-Apr=2, ..., Nov-Dec=6)
    const month = new Date().getMonth() + 1;
    const cicloNumeroEfetivo = ciclo?.numero ?? Math.ceil(month / 2);

    if (!ciclo) {
      return { ciclo: null, cicloNumeroEfetivo, pctTempoDecorrido: null };
    }

    const now = Date.now();
    const inicio = ciclo.dataInicio.getTime();
    const fim = ciclo.dataFimPrevista.getTime();
    const pctTempoDecorrido =
      fim > inicio
        ? Math.min(100, Math.round(((now - inicio) / (fim - inicio)) * 10000) / 100)
        : null;

    return {
      ciclo: { ...CicloViewModel.toHttp(ciclo), cicloNumeroEfetivo, pctTempoDecorrido },
    };
  }
}
