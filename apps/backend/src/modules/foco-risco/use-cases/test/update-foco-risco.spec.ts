import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { mockRequest } from '@test/utils/user-helpers';
import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { UpdateFocoRisco } from '../update-foco-risco';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

import { FocoRisco } from '../../entities/foco-risco';

const buildModule = async (papeis: string[], isPlatformAdmin = false, foco?: FocoRisco) => {
  const readRepo = mock<FocoRiscoReadRepository>();
  const writeRepo = mock<FocoRiscoWriteRepository>();
  const focoMock = foco ?? new FocoRiscoBuilder().withId('foco-1').build();
  readRepo.findById.mockResolvedValue(focoMock);
  writeRepo.save.mockResolvedValue(undefined as any);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      UpdateFocoRisco,
      { provide: FocoRiscoReadRepository, useValue: readRepo },
      { provide: FocoRiscoWriteRepository, useValue: writeRepo },
      {
        provide: REQUEST,
        useValue: mockRequest({
          tenantId: 'cliente-1',
          user: { id: 'user-1', email: 'a@b.com', nome: 'User', clienteId: 'cliente-1', papeis, isPlatformAdmin } as any,
        }),
      },
    ],
  }).compile();

  return {
    useCase: module.get<UpdateFocoRisco>(UpdateFocoRisco),
    readRepo,
    writeRepo,
  };
};

describe('UpdateFocoRisco', () => {
  it('supervisor pode alterar responsavel_id', async () => {
    const { useCase } = await buildModule(['supervisor']);

    await expect(
      useCase.execute('foco-1', { responsavel_id: 'resp-uuid' }),
    ).resolves.toBeUndefined();
  });

  it('isPlatformAdmin pode alterar responsavel_id', async () => {
    const { useCase } = await buildModule([], true);

    await expect(
      useCase.execute('foco-1', { responsavel_id: 'resp-uuid' }),
    ).resolves.toBeUndefined();
  });

  it('agente não pode alterar responsavel_id → ForbiddenException', async () => {
    const { useCase } = await buildModule(['agente']);

    await expect(
      useCase.execute('foco-1', { responsavel_id: 'resp-uuid' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('sem responsavel_id no input → agente pode alterar outros campos', async () => {
    const { useCase } = await buildModule(['agente']);

    await expect(
      useCase.execute('foco-1', { desfecho: 'sem acesso' }),
    ).resolves.toBeUndefined();
  });

  it('foco não encontrado → rejeita com erro', async () => {
    const { useCase, readRepo } = await buildModule(['supervisor']);
    readRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('inexistente', {})).rejects.toBeDefined();
  });

  it('agente envia responsavel_id IGUAL ao atual → passa (paridade IS DISTINCT FROM)', async () => {
    const focoComResponsavel = new FocoRiscoBuilder().withId('foco-1').withResponsavelId('user-X').build();
    const { useCase } = await buildModule(['agente'], false, focoComResponsavel);

    await expect(
      useCase.execute('foco-1', { responsavel_id: 'user-X' }),
    ).resolves.toBeUndefined();
  });
});
