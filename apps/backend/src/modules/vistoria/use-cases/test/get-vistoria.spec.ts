import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { VistoriaException } from '../../errors/vistoria.exception';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { GetVistoria } from '../get-vistoria';
import { VistoriaBuilder } from './builders/vistoria.builder';

describe('GetVistoria', () => {
  let useCase: GetVistoria;
  const readRepo = mock<VistoriaReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetVistoria,
        { provide: VistoriaReadRepository, useValue: readRepo },
      ],
    }).compile();
    useCase = module.get<GetVistoria>(GetVistoria);
  });

  it('deve retornar vistoria encontrada', async () => {
    const vistoria = new VistoriaBuilder().build();
    readRepo.findByIdComDetalhes.mockResolvedValue(vistoria);

    const result = await useCase.execute(vistoria.id!, 'tenant-mock-id');
    expect(result.vistoria).toBe(vistoria);
  });

  it('deve rejeitar vistoria não encontrada', async () => {
    readRepo.findByIdComDetalhes.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('inexistente', 'tenant-mock-id'),
      VistoriaException.notFound(),
    );
  });
});
