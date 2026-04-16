import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { Cliente } from '../entities/cliente';

export class ClienteViewModel {
  static toHttp(cliente: Cliente) {
    return {
      id: cliente.id,
      nome: cliente.nome,
      slug: cliente.slug,
      cnpj: cliente.cnpj,
      contatoEmail: cliente.contatoEmail,
      contatoTelefone: cliente.contatoTelefone,
      latitudeCentro: cliente.latitudeCentro,
      longitudeCentro: cliente.longitudeCentro,
      bounds: cliente.bounds,
      kmzUrl: cliente.kmzUrl,
      ativo: cliente.ativo,
      area: cliente.area,
      endereco: cliente.endereco,
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      estado: cliente.estado,
      cep: cliente.cep,
      uf: cliente.uf,
      ibgeMunicipio: cliente.ibgeMunicipio,
      surtoAtivo: cliente.surtoAtivo,
      janelaRecorrenciaDias: cliente.janelaRecorrenciaDias,
      createdAt: cliente.createdAt,
      updatedAt: cliente.updatedAt,
      ...baseAuditToHttp(cliente),
    };
  }
}
