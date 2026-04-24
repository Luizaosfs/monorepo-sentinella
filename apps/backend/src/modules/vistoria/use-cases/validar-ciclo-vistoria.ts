import { BadRequestException, Injectable } from '@nestjs/common';

import { CicloReadRepository } from '../../ciclo/repositories/ciclo-read.repository';

@Injectable()
export class ValidarCicloVistoria {
  constructor(private cicloReadRepository: CicloReadRepository) {}

  /**
   * Paridade com fn_validar_ciclo_vistoria (SQL):
   * quando ciclo não informado, aplica default 1 do schema (vistorias.ciclo Int @default(1)).
   */
  async execute(clienteId: string, ciclo: number | undefined): Promise<void> {
    const cicloEfetivo = ciclo ?? 1;
    const ativo = await this.cicloReadRepository.findAtivo(clienteId);
    if (!ativo) return;
    if (cicloEfetivo !== ativo.numero) {
      throw new BadRequestException(
        `Ciclo ${cicloEfetivo} inválido — ciclo ativo é o ${ativo.numero}`,
      );
    }
  }
}
