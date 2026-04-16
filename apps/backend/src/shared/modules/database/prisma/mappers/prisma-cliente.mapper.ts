import { Prisma } from '@prisma/client';
import { Cliente } from 'src/modules/cliente/entities/cliente';

type RawCliente = {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  latitude_centro: number | null;
  longitude_centro: number | null;
  bounds: object | null;
  kmz_url: string | null;
  ativo: boolean;
  area: object | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  uf: string | null;
  ibge_municipio: string | null;
  surto_ativo: boolean;
  janela_recorrencia_dias: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export class PrismaClienteMapper {
  static toDomain(raw: RawCliente): Cliente {
    return new Cliente(
      {
        nome: raw.nome,
        slug: raw.slug,
        cnpj: raw.cnpj || undefined,
        contatoEmail: raw.contato_email || undefined,
        contatoTelefone: raw.contato_telefone || undefined,
        latitudeCentro: raw.latitude_centro || undefined,
        longitudeCentro: raw.longitude_centro || undefined,
        bounds: raw.bounds || undefined,
        kmzUrl: raw.kmz_url || undefined,
        ativo: raw.ativo,
        area: raw.area || undefined,
        endereco: raw.endereco || undefined,
        bairro: raw.bairro || undefined,
        cidade: raw.cidade || undefined,
        estado: raw.estado || undefined,
        cep: raw.cep || undefined,
        uf: raw.uf || undefined,
        ibgeMunicipio: raw.ibge_municipio || undefined,
        surtoAtivo: raw.surto_ativo,
        janelaRecorrenciaDias: raw.janela_recorrencia_dias,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        deletedAt: raw.deleted_at || undefined,
      },
    );
  }

  static toPrisma(entity: Cliente) {
    return {
      nome: entity.nome,
      slug: entity.slug,
      cnpj: entity.cnpj || null,
      contato_email: entity.contatoEmail || null,
      contato_telefone: entity.contatoTelefone || null,
      latitude_centro: entity.latitudeCentro || null,
      longitude_centro: entity.longitudeCentro || null,
      bounds: entity.bounds ?? Prisma.JsonNull,
      kmz_url: entity.kmzUrl || null,
      ativo: entity.ativo,
      area: entity.area ?? Prisma.JsonNull,
      endereco: entity.endereco || null,
      bairro: entity.bairro || null,
      cidade: entity.cidade || null,
      estado: entity.estado || null,
      cep: entity.cep || null,
      uf: entity.uf || null,
      ibge_municipio: entity.ibgeMunicipio || null,
      surto_ativo: entity.surtoAtivo,
      janela_recorrencia_dias: entity.janelaRecorrenciaDias,
      updated_at: new Date(),
    };
  }
}
