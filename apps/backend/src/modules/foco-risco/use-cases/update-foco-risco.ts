import { Injectable } from '@nestjs/common';

import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

export interface UpdateFocoRiscoInput {
  responsavel_id?: string;
  desfecho?: string;
  imovel_id?: string;
}

@Injectable()
export class UpdateFocoRisco {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
  ) {}

  async execute(id: string, input: UpdateFocoRiscoInput): Promise<void> {
    const foco = await this.readRepository.findById(id);
    if (!foco) throw FocoRiscoException.notFound();

    if (input.responsavel_id !== undefined) foco.responsavelId = input.responsavel_id;
    if (input.desfecho !== undefined) foco.desfecho = input.desfecho;
    if (input.imovel_id !== undefined) foco.imovelId = input.imovel_id;

    await this.writeRepository.save(foco);
  }
}
