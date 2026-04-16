import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { CreateImovelBody } from '../dtos/create-imovel.body';
import { Imovel } from '../entities/imovel';
import { ImovelWriteRepository } from '../repositories/imovel-write.repository';

@Injectable()
export class CreateImovel {
  constructor(
    private writeRepository: ImovelWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreateImovelBody) {
    const imovel = new Imovel(
      {
        clienteId: this.req['tenantId'],
        regiaoId: input.regiaoId,
        tipoImovel: input.tipoImovel ?? 'residencial',
        logradouro: input.logradouro,
        numero: input.numero,
        complemento: input.complemento,
        bairro: input.bairro,
        quarteirao: input.quarteirao,
        latitude: input.latitude,
        longitude: input.longitude,
        ativo: true,
        proprietarioAusente: input.proprietarioAusente ?? false,
        tipoAusencia: input.tipoAusencia,
        contatoProprietario: input.contatoProprietario,
        temAnimalAgressivo: input.temAnimalAgressivo ?? false,
        historicoRecusa: input.historicoRecusa ?? false,
        temCalha: input.temCalha ?? false,
        calhaAcessivel: input.calhaAcessivel ?? true,
        prioridadeDrone: input.prioridadeDrone ?? false,
        notificacaoFormalEm: input.notificacaoFormalEm as Date | undefined,
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.writeRepository.create(imovel);
    return { imovel: created };
  }
}
