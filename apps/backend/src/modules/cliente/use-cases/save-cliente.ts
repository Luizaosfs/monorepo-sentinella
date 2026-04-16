import { Injectable } from '@nestjs/common';

import { SaveClienteBody } from '../dtos/save-cliente.body';
import { ClienteException } from '../errors/cliente.exception';
import { ClienteReadRepository } from '../repositories/cliente-read.repository';
import { ClienteWriteRepository } from '../repositories/cliente-write.repository';

@Injectable()
export class SaveCliente {
  constructor(
    private readRepository: ClienteReadRepository,
    private writeRepository: ClienteWriteRepository,
  ) {}

  async execute(id: string, input: SaveClienteBody) {
    const cliente = await this.readRepository.findById(id);

    if (!cliente) {
      throw ClienteException.notFound();
    }

    if (input.nome !== undefined) cliente.nome = input.nome;
    if (input.cnpj !== undefined) cliente.cnpj = input.cnpj;
    if (input.contatoEmail !== undefined)
      cliente.contatoEmail = input.contatoEmail;
    if (input.contatoTelefone !== undefined)
      cliente.contatoTelefone = input.contatoTelefone;
    if (input.latitudeCentro !== undefined)
      cliente.latitudeCentro = input.latitudeCentro;
    if (input.longitudeCentro !== undefined)
      cliente.longitudeCentro = input.longitudeCentro;
    if (input.bounds !== undefined) cliente.bounds = input.bounds;
    if (input.kmzUrl !== undefined) cliente.kmzUrl = input.kmzUrl;
    if (input.ativo !== undefined) cliente.ativo = input.ativo;
    if (input.area !== undefined) cliente.area = input.area;
    if (input.endereco !== undefined) cliente.endereco = input.endereco;
    if (input.bairro !== undefined) cliente.bairro = input.bairro;
    if (input.cidade !== undefined) cliente.cidade = input.cidade;
    if (input.estado !== undefined) cliente.estado = input.estado;
    if (input.cep !== undefined) cliente.cep = input.cep;
    if (input.uf !== undefined) cliente.uf = input.uf;
    if (input.ibgeMunicipio !== undefined)
      cliente.ibgeMunicipio = input.ibgeMunicipio;
    if (input.surtoAtivo !== undefined) cliente.surtoAtivo = input.surtoAtivo;
    if (input.janelaRecorrenciaDias !== undefined)
      cliente.janelaRecorrenciaDias = input.janelaRecorrenciaDias;

    await this.writeRepository.save(cliente);

    return { cliente };
  }
}
