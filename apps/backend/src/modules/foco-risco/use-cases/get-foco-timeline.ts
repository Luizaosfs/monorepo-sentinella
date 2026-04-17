import { Injectable } from '@nestjs/common';

import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';

@Injectable()
export class GetFocoTimeline {
  constructor(private repository: FocoRiscoReadRepository) {}

  async execute(focoId: string) {
    return this.repository.findTimeline(focoId);
  }
}
