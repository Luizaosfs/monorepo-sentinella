import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { mockRequest } from '@test/utils/user-helpers';

import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FilterFocoRisco } from '../filter-foco-risco';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

// Nota: a whitelist de status/prioridade é aplicada no PrismaFocoRiscoReadRepository
// (camada de implementação). Os testes abaixo validam que o use-case repassa os filtros
// ao repositório sem alteração — o repositório é responsável por rejeitar valores inválidos.
// Veja: src/shared/security/sql-whitelists.spec.ts para os testes de validação direta.

describe('FilterFocoRisco', () => {
  let useCase: FilterFocoRisco;
  let queryRawMock: jest.Mock;
  const readRepo = mock<FocoRiscoReadRepository>();

  async function buildWithRequest(req: ReturnType<typeof mockRequest>) {
    queryRawMock = jest.fn().mockResolvedValue([]);
    const prismaValue = { client: { $queryRaw: queryRawMock } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterFocoRisco,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: PrismaService, useValue: prismaValue },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();
    return module.get<FilterFocoRisco>(FilterFocoRisco);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    useCase = await buildWithRequest(
      mockRequest({ user: { id: 'supervisor-uuid', email: 'sup@test.com', nome: 'Supervisor', clienteId: 'test-cliente-id', papeis: ['supervisor'] } }),
    );
  });

  it('deve retornar lista de focos filtrados', async () => {
    const focos = [
      new FocoRiscoBuilder().withId('f1').withStatus('suspeita').build(),
      new FocoRiscoBuilder().withId('f2').withStatus('em_triagem').build(),
    ];
    readRepo.findAll.mockResolvedValue(focos);

    const result = await useCase.execute({ clienteId: 'cliente-uuid-1' });

    expect(result.focos).toHaveLength(2);
    expect(readRepo.findAll).toHaveBeenCalledWith({ clienteId: 'cliente-uuid-1' });
  });

  it('deve retornar lista vazia quando não há focos', async () => {
    readRepo.findAll.mockResolvedValue([]);

    const result = await useCase.execute({});

    expect(result.focos).toHaveLength(0);
  });

  describe('ownership — agente vê apenas focos do seu território', () => {
    it('agente com território: quadraIds são passados ao repositório (responsavel_id ignorado)', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } }),
      );
      queryRawMock.mockResolvedValue([{ quadra_id: 'q-uuid-1' }]);
      readRepo.findAll.mockResolvedValue([]);

      await uc.execute({ clienteId: 'cliente-uuid-1', responsavel_id: 'outro-uuid' });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ quadraIds: ['q-uuid-1'] }),
      );
      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.not.objectContaining({ responsavel_id: expect.anything() }),
      );
    });

    it('agente sem território: retorna lista vazia sem consultar repositório', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } }),
      );
      // queryRawMock retorna [] por padrão

      const result = await uc.execute({ clienteId: 'cliente-uuid-1' });

      expect(result.focos).toHaveLength(0);
      expect(readRepo.findAll).not.toHaveBeenCalled();
    });

    it('supervisor repassa responsavelId do input sem alteração', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'supervisor-uuid', email: 'sup@test.com', nome: 'Supervisor', clienteId: 'test-cliente-id', papeis: ['supervisor'] } }),
      );
      readRepo.findAll.mockResolvedValue([]);

      await uc.execute({ clienteId: 'cliente-uuid-1', responsavel_id: 'agente-especifico' });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ responsavel_id: 'agente-especifico' }),
      );
    });

    it('supervisor sem responsavelId no input: não injeta filtro de responsavel', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'supervisor-uuid', email: 'sup@test.com', nome: 'Supervisor', clienteId: 'test-cliente-id', papeis: ['supervisor'] } }),
      );
      readRepo.findAll.mockResolvedValue([]);

      await uc.execute({ clienteId: 'cliente-uuid-1' });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.not.objectContaining({ responsavelId: expect.anything() }),
      );
    });

    it('admin (isPlatformAdmin) repassa filtros sem restrição', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'admin-uuid', email: 'admin@test.com', nome: 'Admin', clienteId: 'test-cliente-id', papeis: ['admin'], isPlatformAdmin: true } as any }),
      );
      readRepo.findAll.mockResolvedValue([]);

      await uc.execute({ clienteId: 'cliente-uuid-1' });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.not.objectContaining({ responsavelId: expect.anything() }),
      );
    });
  });

  describe('filtros de status e prioridade — repasse ao repositório', () => {
    it('status válido aguardando_nova_tentativa é repassado ao repositório', async () => {
      readRepo.findAll.mockResolvedValue([]);

      await useCase.execute({ clienteId: 'cliente-uuid-1', status: ['aguardando_nova_tentativa'] as any });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['aguardando_nova_tentativa'] }),
      );
    });

    it('array de status múltiplos válidos é repassado integralmente', async () => {
      readRepo.findAll.mockResolvedValue([]);

      await useCase.execute({
        clienteId: 'cliente-uuid-1',
        status: ['suspeita', 'em_triagem', 'aguarda_inspecao'] as any,
      });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['suspeita', 'em_triagem', 'aguarda_inspecao'] }),
      );
    });

    it('prioridade válida P1 é repassada ao repositório', async () => {
      readRepo.findAll.mockResolvedValue([]);

      await useCase.execute({ clienteId: 'cliente-uuid-1', prioridade: ['P1'] as any });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ prioridade: ['P1'] }),
      );
    });
  });

  describe('filtro pendente_decisao_supervisor', () => {
    it('supervisor: pendente_decisao_supervisor=true é repassado ao repositório', async () => {
      readRepo.findAll.mockResolvedValue([]);

      await useCase.execute({ clienteId: 'cliente-uuid-1', pendente_decisao_supervisor: true });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ pendente_decisao_supervisor: true }),
      );
    });

    it('supervisor: sem filtro pendente_decisao_supervisor não injeta o campo', async () => {
      readRepo.findAll.mockResolvedValue([]);

      await useCase.execute({ clienteId: 'cliente-uuid-1' });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.not.objectContaining({ pendente_decisao_supervisor: expect.anything() }),
      );
    });

    it('retorna focos com pendente_decisao_supervisor=true quando repositório retorna', async () => {
      const focos = [
        new FocoRiscoBuilder().withId('f-pend-1').withStatus('aguarda_inspecao').build(),
        new FocoRiscoBuilder().withId('f-pend-2').withStatus('em_inspecao').build(),
      ];
      readRepo.findAll.mockResolvedValue(focos);

      const result = await useCase.execute({ clienteId: 'cliente-uuid-1', pendente_decisao_supervisor: true });

      expect(result.focos).toHaveLength(2);
      expect(result.focos[0].id).toBe('f-pend-1');
    });
  });
});
