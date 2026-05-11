import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { mockRequest } from '@test/utils/user-helpers';
import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';
import { ListFocosTerritorioUseCase } from '../list-focos-territorio';

const makeQueryRawMock = (rows: { quadra_id: string }[]) =>
  jest.fn().mockResolvedValue(rows);

describe('ListFocosTerritorioUseCase', () => {
  let repository: MockProxy<FocoRiscoReadRepository>;
  let queryRawMock: jest.Mock;

  async function build(req: ReturnType<typeof mockRequest>) {
    repository = mock<FocoRiscoReadRepository>();
    queryRawMock = makeQueryRawMock([]);

    const prismaValue = { client: { $queryRaw: queryRawMock } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListFocosTerritorioUseCase,
        { provide: FocoRiscoReadRepository, useValue: repository },
        { provide: PrismaService, useValue: prismaValue },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();

    return module.get<ListFocosTerritorioUseCase>(ListFocosTerritorioUseCase);
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
    it('retorna focos das quadras do território', async () => {
      const uc = await build(agenteReq);
      queryRawMock.mockResolvedValue([{ quadra_id: 'q-uuid-1' }]);
      repository.findAll.mockResolvedValue([
        new FocoRiscoBuilder().withId('f1').build(),
      ]);

      const result = await uc.execute('cliente-id');

      expect(result).toHaveLength(1);
      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ quadraIds: ['q-uuid-1'] }),
      );
    });

    it('NÃO usa responsavel_id — passa apenas quadraIds', async () => {
      const uc = await build(agenteReq);
      queryRawMock.mockResolvedValue([{ quadra_id: 'q-uuid-1' }]);
      repository.findAll.mockResolvedValue([]);

      await uc.execute('cliente-id');

      expect(repository.findAll).toHaveBeenCalledWith(
        expect.not.objectContaining({ responsavel_id: expect.anything() }),
      );
    });

    it('múltiplas quadras no território — todas incluídas no filtro', async () => {
      const uc = await build(agenteReq);
      queryRawMock.mockResolvedValue([
        { quadra_id: 'q-uuid-1' },
        { quadra_id: 'q-uuid-2' },
      ]);
      repository.findAll.mockResolvedValue([]);

      await uc.execute('cliente-id');

      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ quadraIds: ['q-uuid-1', 'q-uuid-2'] }),
      );
    });
  });

  describe('agente sem território', () => {
    it('retorna lista vazia sem consultar repositório', async () => {
      const uc = await build(agenteReq);
      queryRawMock.mockResolvedValue([]);

      const result = await uc.execute('cliente-id');

      expect(result).toHaveLength(0);
      expect(repository.findAll).not.toHaveBeenCalled();
    });
  });

  describe('supervisor / admin', () => {
    it('supervisor vê todos os focos do cliente sem filtro de quadra', async () => {
      const uc = await build(supervisorReq);
      repository.findAll.mockResolvedValue([
        new FocoRiscoBuilder().withId('f1').build(),
        new FocoRiscoBuilder().withId('f2').build(),
      ]);

      const result = await uc.execute('cliente-id');

      expect(result).toHaveLength(2);
      expect(queryRawMock).not.toHaveBeenCalled();
      expect(repository.findAll).toHaveBeenCalledWith(
        expect.not.objectContaining({ quadraIds: expect.anything() }),
      );
    });

    it('admin (isPlatformAdmin) também recebe todos os focos', async () => {
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
      repository.findAll.mockResolvedValue([new FocoRiscoBuilder().withId('f1').build()]);

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
      expect(repository.findAll).not.toHaveBeenCalled();
    });

    it('Maria ganha acesso a F1 após receber Q1', async () => {
      const mariaReq = mockRequest({
        user: { id: 'maria-id', email: 'm@test.com', nome: 'Maria', clienteId: 'c', papeis: ['agente'] },
      });
      const uc = await build(mariaReq);
      queryRawMock.mockResolvedValue([{ quadra_id: 'q1-uuid' }]);
      repository.findAll.mockResolvedValue([new FocoRiscoBuilder().withId('f1').build()]);

      const result = await uc.execute('c');

      expect(result).toHaveLength(1);
      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ quadraIds: ['q1-uuid'] }),
      );
    });

    it('Centro/Q1 e Jardim/Q1 são quadras distintas (UUIDs diferentes)', async () => {
      const uc = await build(agenteReq);
      queryRawMock.mockResolvedValue([{ quadra_id: 'centro-q1-uuid' }]);
      repository.findAll.mockResolvedValue([]);

      await uc.execute('cliente-id');

      const call = repository.findAll.mock.calls[0][0];
      expect(call.quadraIds).toContain('centro-q1-uuid');
      expect(call.quadraIds).not.toContain('jardim-q1-uuid');
    });
  });
});
