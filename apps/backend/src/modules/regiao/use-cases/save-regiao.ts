import { Injectable } from '@nestjs/common';

import { SaveRegiaoBody } from '../dtos/save-regiao.body';
import { RegiaoException } from '../errors/regiao.exception';
import { RegiaoReadRepository } from '../repositories/regiao-read.repository';
import { RegiaoWriteRepository } from '../repositories/regiao-write.repository';

@Injectable()
export class SaveRegiao {
  constructor(
    private readRepository: RegiaoReadRepository,
    private writeRepository: RegiaoWriteRepository,
  ) {}

  async execute(id: string, input: SaveRegiaoBody) {
    const regiao = await this.readRepository.findById(id);
    if (!regiao) throw RegiaoException.notFound();

    if (input.nome !== undefined) regiao.nome = input.nome;
    if (input.tipo !== undefined) regiao.tipo = input.tipo;
    if (input.cor !== undefined) regiao.cor = input.cor;
    if (input.geojson !== undefined) regiao.geojson = input.geojson;
    if (input.ativo !== undefined) regiao.ativo = input.ativo;

    await this.writeRepository.save(regiao);
    return { regiao };
  }
}
