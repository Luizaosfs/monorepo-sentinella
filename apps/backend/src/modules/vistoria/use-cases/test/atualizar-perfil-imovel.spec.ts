import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { Imovel } from '../../../imovel/entities/imovel';
import { ImovelReadRepository } from '../../../imovel/repositories/imovel-read.repository';
import { ImovelWriteRepository } from '../../../imovel/repositories/imovel-write.repository';
import { Job } from '../../../job/entities/job';
import { JobWriteRepository } from '../../../job/repositories/job-write.repository';
import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { AtualizarPerfilImovel, AtualizarPerfilImovelInput } from '../atualizar-perfil-imovel';

const IMOVEL_ID = 'imovel-uuid-1';
const CLIENTE_ID = 'cliente-uuid-1';
const VISTORIA_ID = 'vistoria-uuid-1';
const AGENTE_ID = 'agente-uuid-1';

function makeImovel(prioridadeDrone: boolean): Imovel {
  return new Imovel(
    {
      clienteId: CLIENTE_ID,
      tipoImovel: 'residencial',
      ativo: true,
      proprietarioAusente: false,
      temAnimalAgressivo: false,
      historicoRecusa: false,
      temCalha: false,
      calhaAcessivel: true,
      prioridadeDrone,
    },
    { id: IMOVEL_ID },
  );
}

function makeInput(overrides: Partial<AtualizarPerfilImovelInput> = {}): AtualizarPerfilImovelInput {
  return {
    imovelId: IMOVEL_ID,
    vistoriaId: VISTORIA_ID,
    agenteId: AGENTE_ID,
    clienteId: CLIENTE_ID,
    ...overrides,
  };
}

describe('AtualizarPerfilImovel', () => {
  let useCase: AtualizarPerfilImovel;
  const imovelRead = mock<ImovelReadRepository>();
  const imovelWrite = mock<ImovelWriteRepository>();
  const vistoriaRead = mock<VistoriaReadRepository>();
  const jobWrite = mock<JobWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-06-01T10:00:00Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtualizarPerfilImovel,
        { provide: ImovelReadRepository, useValue: imovelRead },
        { provide: ImovelWriteRepository, useValue: imovelWrite },
        { provide: VistoriaReadRepository, useValue: vistoriaRead },
        { provide: JobWriteRepository, useValue: jobWrite },
      ],
    }).compile();
    useCase = module.get<AtualizarPerfilImovel>(AtualizarPerfilImovel);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Branch 1: >=3 && !eraAtivoDrone → marca + enfileira job (primeira ativação)
  it('Branch 1: >=3 tentativas + prioridadeDrone=false → marca historicoRecusa+prioridade e enfileira job', async () => {
    imovelRead.findById.mockResolvedValue(makeImovel(false));
    vistoriaRead.countSemAcessoPorImovel.mockResolvedValue(3);
    imovelWrite.atualizarPerfilDrone.mockResolvedValue();
    jobWrite.create.mockResolvedValue({} as Job);

    await useCase.execute(makeInput());

    expect(imovelWrite.atualizarPerfilDrone).toHaveBeenCalledWith(IMOVEL_ID, CLIENTE_ID, {
      historicoRecusa: true,
      prioridadeDrone: true,
    });
    expect(jobWrite.create).toHaveBeenCalledTimes(1);
  });

  // Branch 2: >=3 && eraAtivoDrone → marca SEM enfileirar job
  it('Branch 2: >=3 tentativas + prioridadeDrone=true → marca SEM enfileirar job (guard primeira ativação)', async () => {
    imovelRead.findById.mockResolvedValue(makeImovel(true));
    vistoriaRead.countSemAcessoPorImovel.mockResolvedValue(5);
    imovelWrite.atualizarPerfilDrone.mockResolvedValue();

    await useCase.execute(makeInput());

    expect(imovelWrite.atualizarPerfilDrone).toHaveBeenCalledWith(IMOVEL_ID, CLIENTE_ID, {
      historicoRecusa: true,
      prioridadeDrone: true,
    });
    expect(jobWrite.create).not.toHaveBeenCalled();
  });

  // Branch 3: <3 && eraAtivoDrone → reseta prioridadeDrone APENAS
  it('Branch 3: <3 tentativas + prioridadeDrone=true → reseta flag', async () => {
    imovelRead.findById.mockResolvedValue(makeImovel(true));
    vistoriaRead.countSemAcessoPorImovel.mockResolvedValue(2);
    imovelWrite.atualizarPerfilDrone.mockResolvedValue();

    await useCase.execute(makeInput());

    expect(imovelWrite.atualizarPerfilDrone).toHaveBeenCalledWith(IMOVEL_ID, CLIENTE_ID, {
      prioridadeDrone: false,
    });
    expect(jobWrite.create).not.toHaveBeenCalled();
  });

  it('Branch 3: historicoRecusa NÃO é passado ao repo (registro histórico permanente)', async () => {
    imovelRead.findById.mockResolvedValue(makeImovel(true));
    vistoriaRead.countSemAcessoPorImovel.mockResolvedValue(1);
    imovelWrite.atualizarPerfilDrone.mockResolvedValue();

    await useCase.execute(makeInput());

    const callData = imovelWrite.atualizarPerfilDrone.mock.calls[0][2];
    expect(callData).not.toHaveProperty('historicoRecusa');
  });

  // Branch 4: <3 && !eraAtivoDrone → no-op
  it('Branch 4: <3 tentativas + prioridadeDrone=false → zero writes no repo', async () => {
    imovelRead.findById.mockResolvedValue(makeImovel(false));
    vistoriaRead.countSemAcessoPorImovel.mockResolvedValue(2);

    await useCase.execute(makeInput());

    expect(imovelWrite.atualizarPerfilDrone).not.toHaveBeenCalled();
    expect(jobWrite.create).not.toHaveBeenCalled();
  });

  // Limiar exato
  it('limiar exato: 2 tentativas → branch 4 (no-op); 3 tentativas → branch 1', async () => {
    imovelRead.findById.mockResolvedValue(makeImovel(false));
    imovelWrite.atualizarPerfilDrone.mockResolvedValue();
    jobWrite.create.mockResolvedValue({} as Job);

    vistoriaRead.countSemAcessoPorImovel.mockResolvedValue(2);
    await useCase.execute(makeInput());
    expect(imovelWrite.atualizarPerfilDrone).not.toHaveBeenCalled();

    jest.clearAllMocks();
    imovelRead.findById.mockResolvedValue(makeImovel(false));
    vistoriaRead.countSemAcessoPorImovel.mockResolvedValue(3);
    imovelWrite.atualizarPerfilDrone.mockResolvedValue();
    jobWrite.create.mockResolvedValue({} as Job);
    await useCase.execute(makeInput());
    expect(imovelWrite.atualizarPerfilDrone).toHaveBeenCalled();
    expect(jobWrite.create).toHaveBeenCalled();
  });

  // Edge: imóvel não encontrado
  it('imovel não encontrado → return sem writes', async () => {
    imovelRead.findById.mockResolvedValue(null);

    await useCase.execute(makeInput());

    expect(imovelWrite.atualizarPerfilDrone).not.toHaveBeenCalled();
    expect(jobWrite.create).not.toHaveBeenCalled();
  });

  // Janela 90 dias
  it('passa janela de 90 dias para countSemAcessoPorImovel', async () => {
    imovelRead.findById.mockResolvedValue(makeImovel(false));
    vistoriaRead.countSemAcessoPorImovel.mockResolvedValue(0);

    await useCase.execute(makeInput());

    const expectedDesde = new Date('2025-03-03T10:00:00Z'); // 90 dias antes de 2025-06-01
    expect(vistoriaRead.countSemAcessoPorImovel).toHaveBeenCalledWith(IMOVEL_ID, expectedDesde);
  });

  // Job: tipo e payload
  it('Branch 1: job tem tipo "notif_imovel_prioridade_drone"', async () => {
    imovelRead.findById.mockResolvedValue(makeImovel(false));
    vistoriaRead.countSemAcessoPorImovel.mockResolvedValue(3);
    imovelWrite.atualizarPerfilDrone.mockResolvedValue();
    jobWrite.create.mockResolvedValue({} as Job);

    await useCase.execute(makeInput());

    expect(jobWrite.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'notif_imovel_prioridade_drone' }),
    );
  });

  it('Branch 1: payload tem 5 campos snake_case com valores corretos', async () => {
    imovelRead.findById.mockResolvedValue(makeImovel(false));
    vistoriaRead.countSemAcessoPorImovel.mockResolvedValue(4);
    imovelWrite.atualizarPerfilDrone.mockResolvedValue();
    jobWrite.create.mockResolvedValue({} as Job);

    await useCase.execute(makeInput());

    expect(jobWrite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          imovel_id: IMOVEL_ID,
          cliente_id: CLIENTE_ID,
          vistoria_id: VISTORIA_ID,
          agente_id: AGENTE_ID,
          tentativas: 4,
        },
      }),
    );
  });

  it('Branch 1: agenteId undefined → payload.agente_id = null', async () => {
    imovelRead.findById.mockResolvedValue(makeImovel(false));
    vistoriaRead.countSemAcessoPorImovel.mockResolvedValue(3);
    imovelWrite.atualizarPerfilDrone.mockResolvedValue();
    jobWrite.create.mockResolvedValue({} as Job);

    await useCase.execute(makeInput({ agenteId: undefined }));

    expect(jobWrite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ agente_id: null }),
      }),
    );
  });
});
