import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { RegiaoException } from '../errors/regiao.exception';
import { RegiaoReadRepository } from '../repositories/regiao-read.repository';
import { RegiaoWriteRepository } from '../repositories/regiao-write.repository';

@Injectable()
export class DeleteRegiao {
  constructor(
    private readRepository: RegiaoReadRepository,
    private writeRepository: RegiaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = (this.req['tenantId'] as string | undefined) ?? null;
    const regiao = await this.readRepository.findById(id, tenantId);
    if (!regiao) throw RegiaoException.notFound();
    regiao.ativo = false;
    await this.writeRepository.save(regiao);
  }
}
