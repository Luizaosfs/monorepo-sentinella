import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { AddEvidenciaBody } from '../../dtos/add-evidencia.body';
import { OperacaoException } from '../../errors/operacao.exception';
import { OperacaoEvidencia } from '../../entities/operacao';
import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';
import { AddEvidencia } from '../add-evidencia';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('AddEvidencia', () => {
  let useCase: AddEvidencia;
  const readRepo = mock<OperacaoReadRepository>();
  const writeRepo = mock<OperacaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddEvidencia,
        { provide: OperacaoReadRepository, useValue: readRepo },
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest() },
      ],
    }).compile();
    useCase = module.get<AddEvidencia>(AddEvidencia);
  });

  it('deve adicionar evidência a operação existente', async () => {
    const op = new OperacaoBuilder().withId('op-1').build();
    readRepo.findById.mockResolvedValue(op);
    const evidencia: OperacaoEvidencia = {
      id: 'ev-1',
      imageUrl: 'https://cdn.example.com/foto.jpg',
      legenda: 'Foto',
    };
    writeRepo.addEvidencia.mockResolvedValue(evidencia);

    const data = {
      imageUrl: 'https://cdn.example.com/foto.jpg',
      legenda: 'Foto',
    } as AddEvidenciaBody;

    const result = await useCase.execute('op-1', data);

    expect(writeRepo.addEvidencia).toHaveBeenCalledWith({
      operacaoId: 'op-1',
      imageUrl: data.imageUrl,
      legenda: data.legenda,
      publicId: undefined,
    });
    expect(result.evidencia).toBe(evidencia);
  });

  it('deve rejeitar operação não encontrada', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () =>
        useCase.execute('x', {
          imageUrl: 'https://cdn.example.com/foto.jpg',
        } as AddEvidenciaBody),
      OperacaoException.notFound(),
    );
    expect(writeRepo.addEvidencia).not.toHaveBeenCalled();
  });
});
