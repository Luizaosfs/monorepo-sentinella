import { Injectable } from '@nestjs/common';

import { PluvioReadRepository } from '../repositories/pluvio-read.repository';

@Injectable()
export class FilterRisco {
  constructor(private repository: PluvioReadRepository) {}

  async execute(regiaoIds: string[]) {
    const riscos = await this.repository.findRiscoByRegiaoIds(regiaoIds);
    return { riscos };
  }
}
