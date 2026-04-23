import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { VistoriaException } from '../../errors/vistoria.exception';
import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { ConsolidarVistoria } from '../consolidar-vistoria';
import { SaveVistoria } from '../save-vistoria';
import { VistoriaBuilder } from './builders/vistoria.builder';

describe('SaveVistoria', () => {
  let useCase: SaveVistoria;
  const readRepo = mock<VistoriaReadRepository>();
  const writeRepo = mock<VistoriaWriteRepository>();
  const mockConsolidar = { execute: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveVistoria,
        { provide: VistoriaReadRepository, useValue: readRepo },
        { provide: VistoriaWriteRepository, useValue: writeRepo },
        { provide: ConsolidarVistoria, useValue: mockConsolidar },
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

  it('invoca hook ConsolidarVistoria após salvar vistoria', async () => {
    const v = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000d1').withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(v);

    await useCase.execute(v.id!, { status: 'concluida' });

    expect(mockConsolidar.execute).toHaveBeenCalledWith({
      vistoriaId: v.id,
      motivo: 'automático — UPDATE em vistorias',
    });
  });

  it('falha no hook ConsolidarVistoria não deve quebrar o save', async () => {
    const v = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000d2').withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(v);
    mockConsolidar.execute.mockRejectedValueOnce(new Error('boom'));

    const result = await useCase.execute(v.id!, { status: 'concluida' });

    expect(result.vistoria).toBe(v);
  });

  it('muda coluna-input (status) → hook é chamado', async () => {
    const v = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000d3').withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(v);

    await useCase.execute(v.id!, { status: 'concluida' });

    expect(mockConsolidar.execute).toHaveBeenCalledTimes(1);
  });

  it('muda apenas campo não-input (observacao) → hook NÃO é chamado', async () => {
    const v = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000d4').withStatus('concluida').build();
    readRepo.findById.mockResolvedValue(v);

    await useCase.execute(v.id!, { observacao: 'nova observacao' });

    expect(mockConsolidar.execute).not.toHaveBeenCalled();
  });

  it('múltiplas colunas-input mudam → hook é chamado apenas 1 vez', async () => {
    const v = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000d5').withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(v);

    await useCase.execute(v.id!, { status: 'concluida', gravidas: true, idosos: true });

    expect(mockConsolidar.execute).toHaveBeenCalledTimes(1);
  });
});
