import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { mockRequest } from '@test/utils/user-helpers';

import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FilterFocoRisco } from '../filter-foco-risco';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('FilterFocoRisco', () => {
  let useCase: FilterFocoRisco;
  const readRepo = mock<FocoRiscoReadRepository>();

  async function buildWithRequest(req: ReturnType<typeof mockRequest>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterFocoRisco,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
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

  describe('ownership — agente vê apenas focos atribuídos a si', () => {
    it('agente: responsavelId do body é substituído pelo user.id', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } }),
      );
      readRepo.findAll.mockResolvedValue([]);

      await uc.execute({ clienteId: 'cliente-uuid-1', responsavelId: 'outro-uuid' });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ responsavelId: 'agente-uuid' }),
      );
    });

    it('agente sem responsavelId no input: injeta user.id automaticamente', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } }),
      );
      readRepo.findAll.mockResolvedValue([]);

      await uc.execute({ clienteId: 'cliente-uuid-1' });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ responsavelId: 'agente-uuid' }),
      );
    });

    it('supervisor repassa responsavelId do input sem alteração', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'supervisor-uuid', email: 'sup@test.com', nome: 'Supervisor', clienteId: 'test-cliente-id', papeis: ['supervisor'] } }),
      );
      readRepo.findAll.mockResolvedValue([]);

      await uc.execute({ clienteId: 'cliente-uuid-1', responsavelId: 'agente-especifico' });

      expect(readRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ responsavelId: 'agente-especifico' }),
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
});
