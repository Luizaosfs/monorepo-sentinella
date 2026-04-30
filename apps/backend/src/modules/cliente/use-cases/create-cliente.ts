import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Request } from 'express';

import { CreateClienteBody } from '../dtos/create-cliente.body';
import { Cliente } from '../entities/cliente';
import { ClienteException } from '../errors/cliente.exception';
import { ClienteReadRepository } from '../repositories/cliente-read.repository';
import { ClienteWriteRepository } from '../repositories/cliente-write.repository';
import { SeedClienteNovo, SeedClienteNovoResult } from './seed-cliente-novo';

@Injectable()
export class CreateCliente {
  private readonly logger = new Logger(CreateCliente.name);

  constructor(
    private prisma: PrismaService,
    private readRepository: ClienteReadRepository,
    private writeRepository: ClienteWriteRepository,
    private seedClienteNovo: SeedClienteNovo,
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

    // Cliente novo + 7 seeds em transação atômica.
    // Falha em qualquer seed faz rollback do INSERT do cliente.
    let created!: Cliente;
    let seedResult!: SeedClienteNovoResult;
    await this.prisma.client.$transaction(async (tx) => {
      created = await this.writeRepository.create(cliente, tx);
      if (!created.id) {
        throw new Error('Cliente criado sem id retornado pelo repository');
      }
      seedResult = await this.seedClienteNovo.execute(created.id, tx);
    });

    this.logger.log(
      `Cliente ${created.id} criado e seeds aplicados: ${JSON.stringify(seedResult)}`,
    );

    return { cliente: created };
  }
}
