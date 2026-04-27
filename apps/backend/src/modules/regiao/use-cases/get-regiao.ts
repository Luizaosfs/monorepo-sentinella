import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { RegiaoException } from '../errors/regiao.exception';
import { RegiaoReadRepository } from '../repositories/regiao-read.repository';

@Injectable()
export class GetRegiao {
  constructor(
    private repository: RegiaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = (this.req['tenantId'] as string | undefined) ?? null;
    const regiao = await this.repository.findById(id, tenantId);
    if (!regiao) throw RegiaoException.notFound();
    return { regiao };
  }
}
