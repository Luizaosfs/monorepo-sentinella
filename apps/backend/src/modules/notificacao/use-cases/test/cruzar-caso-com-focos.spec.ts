import { mock } from 'jest-mock-extended';

import { NotificacaoWriteRepository } from '../../repositories/notificacao-write.repository';
import { CruzarCasoComFocos } from '../cruzar-caso-com-focos';

describe('CruzarCasoComFocos', () => {
  let uc: CruzarCasoComFocos;
  let queryRaw: jest.Mock;
  let executeRaw: jest.Mock;
  let writeRepository: ReturnType<typeof mock<NotificacaoWriteRepository>>;

  beforeEach(() => {
    queryRaw = jest.fn();
    executeRaw = jest.fn();
    writeRepository = mock<NotificacaoWriteRepository>();
    writeRepository.vincularFoco.mockResolvedValue(undefined);

    uc = new CruzarCasoComFocos(
      { client: { $queryRaw: queryRaw, $executeRaw: executeRaw } } as never,
      writeRepository,
    );
  });

  it('retorna 0 e não consulta DB quando lat/lng são nulos', async () => {
    const r = await uc.execute({ casoId: 'c1', clienteId: 'cli1', latitude: null, longitude: null });
    expect(r.cruzamentos).toBe(0);
    expect(r.principalFocoId).toBeNull();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('retorna 0 quando nenhum foco está no raio', async () => {
    queryRaw.mockResolvedValueOnce([]);
    const r = await uc.execute({ casoId: 'c1', clienteId: 'cli1', latitude: -23.5, longitude: -46.6 });
    expect(r.cruzamentos).toBe(0);
    expect(r.principalFocoId).toBeNull();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(writeRepository.vincularFoco).not.toHaveBeenCalled();
  });

  it('insere cruzamento e atualiza foco quando há focos próximos', async () => {
    queryRaw.mockResolvedValueOnce([
      { id: 'f1', levantamento_item_id: 'li1', distancia_metros: 120, prioridade: 'P3' },
    ]);
    executeRaw.mockResolvedValue(1);

    const r = await uc.execute({ casoId: 'c1', clienteId: 'cli1', latitude: -23.5, longitude: -46.6 });

    expect(r.cruzamentos).toBe(1);
    expect(r.principalFocoId).toBe('f1');
    expect(r.principalDistanciaMetros).toBe(120);
    // 1 INSERT caso_foco_cruzamento + 1 UPDATE focos_risco prioridade
    expect(executeRaw).toHaveBeenCalledTimes(2);
    // vínculo principal persistido via repositório
    expect(writeRepository.vincularFoco).toHaveBeenCalledTimes(1);
    expect(writeRepository.vincularFoco).toHaveBeenCalledWith('c1', expect.objectContaining({
      focoRiscoId: 'f1',
      vinculoTipo: 'existente_300m',
      distanciaMetros: 120,
    }));
  });

  it('lida com múltiplos focos: principal é o mais próximo', async () => {
    queryRaw.mockResolvedValueOnce([
      { id: 'f1', levantamento_item_id: 'li1', distancia_metros: 80, prioridade: 'P3' },
      { id: 'f2', levantamento_item_id: 'li2', distancia_metros: 200, prioridade: 'P1' },
    ]);
    // f1: INSERT=1, UPDATE focos_risco=1; f2: INSERT=0 (conflict), UPDATE=0 (já P1)
    executeRaw
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const r = await uc.execute({ casoId: 'c1', clienteId: 'cli1', latitude: -23.5, longitude: -46.6 });

    expect(r.cruzamentos).toBe(1);
    expect(r.principalFocoId).toBe('f1');
    expect(executeRaw).toHaveBeenCalledTimes(4);
    // vínculo aponta para o foco principal (f1 — mais próximo)
    expect(writeRepository.vincularFoco).toHaveBeenCalledWith('c1', expect.objectContaining({
      focoRiscoId: 'f1',
      distanciaMetros: 80,
    }));
  });
});
