import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { VistoriaException } from '../../errors/vistoria.exception';
import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { SaveVistoria } from '../save-vistoria';
import { VistoriaBuilder } from './builders/vistoria.builder';

describe('SaveVistoria', () => {
  let useCase: SaveVistoria;
  const readRepo = mock<VistoriaReadRepository>();
  const writeRepo = mock<VistoriaWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveVistoria,
        { provide: VistoriaReadRepository, useValue: readRepo },
        { provide: VistoriaWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<SaveVistoria>(SaveVistoria);
  });

  it('deve lançar notFound quando vistoria não existe', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () =>
        useCase.execute('00000000-0000-4000-8000-0000000000ff', {
          status: 'ok',
        }),
      VistoriaException.notFound(),
    );
  });

  it('deve aplicar patch e salvar', async () => {
    const v = new VistoriaBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(v);

    const { vistoria } = await useCase.execute(v.id!, {
      status: 'concluida',
      observacao: 'ok',
    });

    expect(vistoria.status).toBe('concluida');
    expect(vistoria.observacao).toBe('ok');
    expect(writeRepo.save).toHaveBeenCalledWith(vistoria);
  });
});
