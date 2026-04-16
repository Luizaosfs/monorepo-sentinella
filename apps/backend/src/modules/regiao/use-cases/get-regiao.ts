import { Injectable } from '@nestjs/common';

import { RegiaoException } from '../errors/regiao.exception';
import { RegiaoReadRepository } from '../repositories/regiao-read.repository';

@Injectable()
export class GetRegiao {
  constructor(private repository: RegiaoReadRepository) {}

  async execute(id: string) {
    const regiao = await this.repository.findById(id);
    if (!regiao) throw RegiaoException.notFound();
    return { regiao };
  }
}
