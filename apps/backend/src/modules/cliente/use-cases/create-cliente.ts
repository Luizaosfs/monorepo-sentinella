import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { CreateClienteBody } from '../dtos/create-cliente.body';
import { Cliente } from '../entities/cliente';
import { ClienteException } from '../errors/cliente.exception';
import { ClienteReadRepository } from '../repositories/cliente-read.repository';
import { ClienteWriteRepository } from '../repositories/cliente-write.repository';

@Injectable()
export class CreateCliente {
  constructor(
    private readRepository: ClienteReadRepository,
    private writeRepository: ClienteWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreateClienteBody) {
    const existente = await this.readRepository.findBySlug(input.slug);

    if (existente) {
      throw ClienteException.slugAlreadyExists();
    }

    const cliente = new Cliente(
      {
        nome: input.nome,
        slug: input.slug,
        cnpj: input.cnpj,
        contatoEmail: input.contatoEmail,
        contatoTelefone: input.contatoTelefone,
        latitudeCentro: input.latitudeCentro,
        longitudeCentro: input.longitudeCentro,
        bounds: input.bounds,
        kmzUrl: input.kmzUrl,
        ativo: true,
        area: input.area,
        endereco: input.endereco,
        bairro: input.bairro,
        cidade: input.cidade,
        estado: input.estado,
        cep: input.cep,
        uf: input.uf,
        ibgeMunicipio: input.ibgeMunicipio,
        surtoAtivo: false,
        janelaRecorrenciaDias: input.janelaRecorrenciaDias ?? 30,
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.writeRepository.create(cliente);

    return { cliente: created };
  }
}
