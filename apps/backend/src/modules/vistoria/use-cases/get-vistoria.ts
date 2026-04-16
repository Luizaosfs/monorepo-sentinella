import { Injectable } from '@nestjs/common';

import { VistoriaException } from '../errors/vistoria.exception';
import { VistoriaReadRepository } from '../repositories/vistoria-read.repository';

@Injectable()
export class GetVistoria {
  constructor(private repository: VistoriaReadRepository) {}

  async execute(id: string) {
    const vistoria = await this.repository.findByIdComDetalhes(id);
    if (!vistoria) throw VistoriaException.notFound();
    return { vistoria };
  }
}
