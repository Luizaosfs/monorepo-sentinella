import { EnfileirarNotifCanalCidadao } from '../enfileirar-notif-canal-cidadao';

function makePrisma(jobId = 'job-uuid-1') {
  return {
    client: {
      job_queue: {
        create: jest.fn().mockResolvedValue({ id: jobId }),
      },
    },
  } as any;
}

describe('EnfileirarNotifCanalCidadao (paridade fn_notificar_foco_cidadao)', () => {
  const baseInput = {
    focoId: 'foco-uuid-1',
    clienteId: 'cliente-uuid-1',
    latitude: -23.55,
    longitude: -46.63,
    endereco: 'Rua A, 100',
    suspeitaEm: new Date('2026-04-22T10:00:00Z'),
    origemLevantamentoItemId: 'item-uuid-1',
  };

  it('happy path: insere job_queue com tipo, status e payload completo', async () => {
    const prisma = makePrisma('job-1');
    const useCase = new EnfileirarNotifCanalCidadao(prisma);

    await useCase.execute(baseInput);

    expect(prisma.client.job_queue.create).toHaveBeenCalledWith({
      data: {
        tipo: 'notif_canal_cidadao',
        status: 'pendente',
        payload: {
          foco_id: 'foco-uuid-1',
          cliente_id: 'cliente-uuid-1',
          latitude: -23.55,
          longitude: -46.63,
          endereco: 'Rua A, 100',
          suspeita_em: '2026-04-22T10:00:00.000Z',
          origem_item_id: 'item-uuid-1',
        },
      },
      select: { id: true },
    });
  });

  it('campos opcionais ausentes vão como null no payload (não falha)', async () => {
    const prisma = makePrisma();
    const useCase = new EnfileirarNotifCanalCidadao(prisma);

    await useCase.execute({
      focoId: 'foco-uuid-2',
      clienteId: 'cliente-uuid-1',
      suspeitaEm: new Date('2026-04-22T10:00:00Z'),
    });

    const call = prisma.client.job_queue.create.mock.calls[0][0];
    expect(call.data.payload).toEqual({
      foco_id: 'foco-uuid-2',
      cliente_id: 'cliente-uuid-1',
      latitude: null,
      longitude: null,
      endereco: null,
      suspeita_em: '2026-04-22T10:00:00.000Z',
      origem_item_id: null,
    });
  });

  it('retorna { jobId } do insert', async () => {
    const prisma = makePrisma('job-id-retornado');
    const useCase = new EnfileirarNotifCanalCidadao(prisma);

    const result = await useCase.execute(baseInput);

    expect(result).toEqual({ jobId: 'job-id-retornado' });
  });

  it('usa a tx recebida — NÃO cai em this.prisma.client', async () => {
    const prisma = makePrisma();
    const useCase = new EnfileirarNotifCanalCidadao(prisma);
    const txCreate = jest.fn().mockResolvedValue({ id: 'job-tx' });
    const tx = { job_queue: { create: txCreate } };

    const result = await useCase.execute(baseInput, tx);

    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(prisma.client.job_queue.create).not.toHaveBeenCalled();
    expect(result.jobId).toBe('job-tx');
  });

  it('se job_queue.create lança, o método PROPAGA (best-effort é no chamador)', async () => {
    const prisma = {
      client: {
        job_queue: {
          create: jest.fn().mockRejectedValue(new Error('db down')),
        },
      },
    } as any;
    const useCase = new EnfileirarNotifCanalCidadao(prisma);

    await expect(useCase.execute(baseInput)).rejects.toThrow('db down');
  });
});
