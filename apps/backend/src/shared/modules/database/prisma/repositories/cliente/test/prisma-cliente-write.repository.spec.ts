import { Test, TestingModule } from '@nestjs/testing';
import { Cliente } from '@modules/cliente/entities/cliente';
import { ClienteBuilder } from '@modules/cliente/use-cases/test/builders/cliente.builder';

import { PrismaClienteMapper } from '../../../mappers/prisma-cliente.mapper';
import { PrismaService } from '../../../prisma.service';
import { PrismaClienteWriteRepository } from '../prisma-cliente-write.repository';

describe('PrismaClienteWriteRepository', () => {
  let repo: PrismaClienteWriteRepository;

  const prismaClientesCreate = jest.fn();
  const prismaClientesUpdate = jest.fn();
  const prismaService = {
    client: {
      clientes: {
        create: prismaClientesCreate,
        update: prismaClientesUpdate,
      },
    },
  };

  const makeRow = (cliente: Cliente) => ({
    id: cliente.id,
    nome: cliente.nome,
    slug: cliente.slug,
    cnpj: cliente.cnpj ?? null,
    contato_email: cliente.contatoEmail ?? null,
    contato_telefone: cliente.contatoTelefone ?? null,
    latitude_centro: cliente.latitudeCentro ?? null,
    longitude_centro: cliente.longitudeCentro ?? null,
    bounds: null,
    kmz_url: null,
    ativo: cliente.ativo,
    area: null,
    endereco: null,
    bairro: null,
    cidade: cliente.cidade ?? null,
    estado: cliente.estado ?? null,
    cep: null,
    uf: cliente.uf ?? null,
    ibge_municipio: cliente.ibgeMunicipio ?? null,
    surto_ativo: cliente.surtoAtivo,
    janela_recorrencia_dias: cliente.janelaRecorrenciaDias,
    created_at: new Date('2026-04-22T00:00:00Z'),
    updated_at: new Date('2026-04-22T00:00:00Z'),
    deleted_at: null,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaClienteWriteRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();
    repo = module.get<PrismaClienteWriteRepository>(PrismaClienteWriteRepository);
  });

  describe('create', () => {
    it('COM tx: usa tx.clientes.create e NÃO usa this.prisma.client.clientes.create', async () => {
      const cliente = new ClienteBuilder().withId('cli-com-tx').build();
      const row = makeRow(cliente);
      const expectedData = PrismaClienteMapper.toPrisma(cliente);
      const fakeTx = {
        clientes: {
          create: jest.fn().mockResolvedValue(row),
        },
      };

      await repo.create(cliente, fakeTx);

      expect(fakeTx.clientes.create).toHaveBeenCalledTimes(1);
      expect(fakeTx.clientes.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nome: expectedData.nome,
          slug: expectedData.slug,
          ativo: expectedData.ativo,
          surto_ativo: expectedData.surto_ativo,
          janela_recorrencia_dias: expectedData.janela_recorrencia_dias,
        }),
      });
      expect(prismaClientesCreate).not.toHaveBeenCalled();
    });

    it('SEM tx: usa this.prisma.client.clientes.create', async () => {
      const cliente = new ClienteBuilder().withId('cli-sem-tx').build();
      const row = makeRow(cliente);
      prismaClientesCreate.mockResolvedValue(row);
      const fakeTx = {
        clientes: {
          create: jest.fn(),
        },
      };

      await repo.create(cliente);

      expect(prismaClientesCreate).toHaveBeenCalledTimes(1);
      expect(prismaClientesCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nome: cliente.nome,
          slug: cliente.slug,
        }),
      });
      expect(fakeTx.clientes.create).not.toHaveBeenCalled();
    });

    it('retorno passa por PrismaClienteMapper.toDomain', async () => {
      const cliente = new ClienteBuilder().withId('cli-mapper').build();
      const row = makeRow(cliente);
      const toDomainSpy = jest.spyOn(PrismaClienteMapper, 'toDomain');
      prismaClientesCreate.mockResolvedValue(row);

      const result = await repo.create(cliente);

      expect(toDomainSpy).toHaveBeenCalledWith(row);
      expect(result).toBeInstanceOf(Cliente);
      toDomainSpy.mockRestore();
    });
  });

  describe('save', () => {
    it('NÃO é tx-aware: sempre usa this.prisma.client.clientes.update', async () => {
      const cliente = new ClienteBuilder().withId('cli-save').build();
      const expectedData = PrismaClienteMapper.toPrisma(cliente);
      prismaClientesUpdate.mockResolvedValue(undefined);

      await repo.save(cliente);

      expect(prismaClientesUpdate).toHaveBeenCalledTimes(1);
      expect(prismaClientesUpdate).toHaveBeenCalledWith({
        where: { id: cliente.id },
        data: expect.objectContaining({
          nome: expectedData.nome,
          slug: expectedData.slug,
          ativo: expectedData.ativo,
        }),
      });
    });
  });
});
