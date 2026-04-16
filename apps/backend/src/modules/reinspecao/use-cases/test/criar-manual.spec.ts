import { FocoRiscoReadRepository } from '@modules/foco-risco/repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '@modules/foco-risco/repositories/foco-risco-write.repository';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { FocoRiscoBuilder } from '../../../foco-risco/use-cases/test/builders/foco-risco.builder';
import { ReinspecaoException } from '../../errors/reinspecao.exception';
import { ReinspecaoWriteRepository } from '../../repositories/reinspecao-write.repository';
import { CriarManual } from '../criar-manual';
import { ReinspecaoBuilder } from './builders/reinspecao.builder';

describe('CriarManual', () => {
  let useCase: CriarManual;
  const writeRepo = mock<ReinspecaoWriteRepository>();
  const focoRead = mock<FocoRiscoReadRepository>();
  const focoWrite = mock<FocoRiscoWriteRepository>();

  const baseInput = () => ({
    focoRiscoId: 'foco-uuid-1',
    dataPrevista: new Date('2024-08-01'),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CriarManual,
        { provide: ReinspecaoWriteRepository, useValue: writeRepo },
        { provide: FocoRiscoReadRepository, useValue: focoRead },
        { provide: FocoRiscoWriteRepository, useValue: focoWrite },
        {
          provide: 'REQUEST',
          useValue: mockRequest({
            tenantId: 'test-cliente-id',
            user: {
              id: 'test-user-id',
              email: 't@t.com',
              nome: 'T',
              clienteId: 'test-cliente-id',
              papeis: ['supervisor'],
            },
          }),
        },
      ],
    }).compile();

    useCase = module.get<CriarManual>(CriarManual);
  });

  it('deve criar reinspeção manual vinculada a foco válido', async () => {
    const foco = new FocoRiscoBuilder().withId('foco-uuid-1').withClienteId('test-cliente-id').build();
    focoRead.findById.mockResolvedValue(foco);
    const created = new ReinspecaoBuilder().withFocoRiscoId('foco-uuid-1').build();
    writeRepo.create.mockResolvedValue(created);
    focoWrite.createHistorico.mockResolvedValue({
      clienteId: foco.clienteId,
      statusNovo: foco.status,
    });

    const result = await useCase.execute({
      ...baseInput(),
      clienteId: 'test-cliente-id',
    });

    expect(result.reinspecao.focoRiscoId).toBe('foco-uuid-1');
    expect(writeRepo.create).toHaveBeenCalled();
    expect(focoWrite.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({ tipoEvento: 'reinspecao_agendada', focoRiscoId: foco.id }),
    );
  });

  it('deve rejeitar clienteId ausente', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CriarManual,
        { provide: ReinspecaoWriteRepository, useValue: writeRepo },
        { provide: FocoRiscoReadRepository, useValue: focoRead },
        { provide: FocoRiscoWriteRepository, useValue: focoWrite },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: '' }) },
      ],
    }).compile();
    const uc = module.get<CriarManual>(CriarManual);

    await expectHttpException(
      () => uc.execute({ ...baseInput() }),
      ReinspecaoException.payloadInvalido(),
    );
  });

  it('deve rejeitar foco não encontrado', async () => {
    focoRead.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute({ ...baseInput(), clienteId: 'test-cliente-id' }),
      ReinspecaoException.focoNaoEncontrado(),
    );
  });

  it('deve rejeitar foco de outro tenant', async () => {
    const foco = new FocoRiscoBuilder().withClienteId('outro-tenant-id').build();
    focoRead.findById.mockResolvedValue(foco);

    await expectHttpException(
      () =>
        useCase.execute({
          ...baseInput(),
          clienteId: 'test-cliente-id',
        }),
      ReinspecaoException.forbiddenTenant(),
    );
  });

  it('deve rejeitar non-admin acessando outro tenant', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CriarManual,
        { provide: ReinspecaoWriteRepository, useValue: writeRepo },
        { provide: FocoRiscoReadRepository, useValue: focoRead },
        { provide: FocoRiscoWriteRepository, useValue: focoWrite },
        {
          provide: 'REQUEST',
          useValue: mockRequest({
            tenantId: 'test-cliente-id',
            user: {
              id: 'u',
              email: 'u@u.com',
              nome: 'U',
              clienteId: 'test-cliente-id',
              papeis: ['supervisor'],
            },
          }),
        },
      ],
    }).compile();
    const uc = module.get<CriarManual>(CriarManual);

    await expectHttpException(
      () =>
        uc.execute({
          ...baseInput(),
          clienteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        }),
      ReinspecaoException.forbiddenTenant(),
    );
    expect(focoRead.findById).not.toHaveBeenCalled();
  });
});
