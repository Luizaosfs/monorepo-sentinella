import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { mockRequest } from '@test/utils/user-helpers';
import { ReinspecaoReadRepository } from '../../repositories/reinspecao-read.repository';
import { ReinspecaoBuilder } from './builders/reinspecao.builder';
import { ListReinspecoesTerritorioUseCase } from '../list-reinspecoes-territorio';

const makeQueryRawMock = (rows: { quadra_id: string }[]) =>
  jest.fn().mockResolvedValue(rows);

describe('ListReinspecoesTerritorioUseCase', () => {
  let repository: MockProxy<ReinspecaoReadRepository>;
  let queryRawMock: jest.Mock;

  async function build(req: ReturnType<typeof mockRequest>) {
    repository = mock<ReinspecaoReadRepository>();
    queryRawMock = makeQueryRawMock([]);

    const prismaValue = { client: { $queryRaw: queryRawMock } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListReinspecoesTerritorioUseCase,
        { provide: ReinspecaoReadRepository, useValue: repository },
        { provide: PrismaService, useValue: prismaValue },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();

    return module.get<ListReinspecoesTerritorioUseCase>(ListReinspecoesTerritorioUseCase);
  }

  const agenteReq = mockRequest({
    user: {
      id: 'agente-id',
      email: 'agente@test.com',
      nome: 'Agente',
      clienteId: 'cliente-id',
      papeis: ['agente'],
    },
  });

  const supervisorReq = mockRequest({
    user: {
      id: 'sup-id',
      email: 'sup@test.com',
      nome: 'Supervisor',
      clienteId: 'cliente-id',
      papeis: ['supervisor'],
    },
  });

  beforeEach(() => jest.clearAllMocks());

  describe('agente com território', () => {
    it('retorna reinspeções das quadras do território', async () => {
      const uc = await build(agenteReq);
      queryRawMock.mockResolvedValue([{ quadra_id: 'q-uuid-1' }]);
      repository.findAllTerritorio.mockResolvedValue([
        new ReinspecaoBuilder().withId('r1').build(),
      ]);

      const result = await uc.execute('cliente-id');

      expect(result).toHaveLength(1);
      expect(repository.findAllTerritorio).toHaveBeenCalledWith('cliente-id', ['q-uuid-1']);
    });

    it('múltiplas quadras no território — todas incluídas na consulta', async () => {
      const uc = await build(agenteReq);
      queryRawMock.mockResolvedValue([
        { quadra_id: 'q-uuid-1' },
        { quadra_id: 'q-uuid-2' },
      ]);
      repository.findAllTerritorio.mockResolvedValue([]);

      await uc.execute('cliente-id');

      expect(repository.findAllTerritorio).toHaveBeenCalledWith('cliente-id', ['q-uuid-1', 'q-uuid-2']);
    });
  });

  describe('agente sem território', () => {
    it('retorna lista vazia sem consultar repositório', async () => {
      const uc = await build(agenteReq);
      queryRawMock.mockResolvedValue([]);

      const result = await uc.execute('cliente-id');

      expect(result).toHaveLength(0);
      expect(repository.findAllTerritorio).not.toHaveBeenCalled();
      expect(repository.findAll).not.toHaveBeenCalled();
    });
  });

  describe('supervisor / admin', () => {
    it('supervisor vê todas as reinspeções do cliente sem filtro de quadra', async () => {
      const uc = await build(supervisorReq);
      repository.findAll.mockResolvedValue([
        new ReinspecaoBuilder().withId('r1').build(),
        new ReinspecaoBuilder().withId('r2').build(),
      ]);

      const result = await uc.execute('cliente-id');

      expect(result).toHaveLength(2);
      expect(queryRawMock).not.toHaveBeenCalled();
      expect(repository.findAll).toHaveBeenCalledWith({ clienteId: 'cliente-id' });
    });

    it('admin (isPlatformAdmin) também recebe todas as reinspeções', async () => {
      const adminReq = mockRequest({
        user: {
          id: 'admin-id',
          email: 'admin@test.com',
          nome: 'Admin',
          clienteId: 'cliente-id',
          papeis: ['admin'],
          isPlatformAdmin: true,
        } as any,
      });
      const uc = await build(adminReq);
      repository.findAll.mockResolvedValue([new ReinspecaoBuilder().withId('r1').build()]);

      const result = await uc.execute('cliente-id');

      expect(result).toHaveLength(1);
      expect(queryRawMock).not.toHaveBeenCalled();
    });
  });

  describe('regra de transferência territorial', () => {
    it('João perde acesso após Q1 migrar para Maria (João sem quadras)', async () => {
      const joaoReq = mockRequest({
        user: { id: 'joao-id', email: 'j@test.com', nome: 'João', clienteId: 'c', papeis: ['agente'] },
      });
      const uc = await build(joaoReq);
      queryRawMock.mockResolvedValue([]);

      const result = await uc.execute('c');

      expect(result).toHaveLength(0);
      expect(repository.findAllTerritorio).not.toHaveBeenCalled();
    });

    it('Maria ganha acesso a R1 após receber Q1', async () => {
      const mariaReq = mockRequest({
        user: { id: 'maria-id', email: 'm@test.com', nome: 'Maria', clienteId: 'c', papeis: ['agente'] },
      });
      const uc = await build(mariaReq);
      queryRawMock.mockResolvedValue([{ quadra_id: 'q1-uuid' }]);
      repository.findAllTerritorio.mockResolvedValue([new ReinspecaoBuilder().withId('r1').build()]);

      const result = await uc.execute('c');

      expect(result).toHaveLength(1);
      expect(repository.findAllTerritorio).toHaveBeenCalledWith('c', ['q1-uuid']);
    });
  });
});
