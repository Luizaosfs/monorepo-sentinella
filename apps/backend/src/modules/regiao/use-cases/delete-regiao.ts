import { Injectable } from '@nestjs/common';

import { RegiaoException } from '../errors/regiao.exception';
import { RegiaoReadRepository } from '../repositories/regiao-read.repository';
import { RegiaoWriteRepository } from '../repositories/regiao-write.repository';

@Injectable()
export class DeleteRegiao {
  constructor(
    private readRepository: RegiaoReadRepository,
    private writeRepository: RegiaoWriteRepository,
  ) {}

  async execute(id: string) {
    const regiao = await this.readRepository.findById(id);
    if (!regiao) throw RegiaoException.notFound();
    regiao.ativo = false;
    await this.writeRepository.save(regiao);
  }
}
