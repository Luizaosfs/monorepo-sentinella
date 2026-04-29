import { HttpStatus, NotFoundException } from '@nestjs/common';
import { DenunciarCidadaoV2 } from '../denunciar-cidadao-v2';

const makeInput = (overrides = {}) => ({
  slug: 'mun-teste',
  descricao: 'Poço com larvas',
  latitude: -23.5505,
  longitude: -46.6333,
  bairroId: undefined,
  ...overrides,
});

const mockCliente = { id: 'cliente-uuid-1111' };

function makePrisma({
  clienteResult = mockCliente,
  rateLimitContagem = 1,
  dedupResult = [] as any[],
  focoId = 'foco-uuid-aaaa',
} = {}) {
  return {
    client: {
      clientes: {
        findFirst: jest.fn().mockResolvedValue(clienteResult),
      },
      regioes: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      focos_risco: {
        create: jest.fn().mockResolvedValue({ id: focoId }),
      },
      foco_risco_historico: {
        create: jest.fn().mockResolvedValue({}),
      },
      canal_cidadao_rate_log: {
        create: jest.fn().mockResolvedValue({}),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ contagem: rateLimitContagem }])
        .mockResolvedValueOnce(dedupResult)
        .mockResolvedValue([{ ultimo: BigInt(1) }]),
      $executeRaw: Object.assign(jest.fn().mockResolvedValue(1), {
        catch: jest.fn(),
      }),
    },
  } as any;
}

function makeEnfileirar() {
  return {
    execute: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
  } as any;
}

describe('DenunciarCidadaoV2', () => {
  it('happy path — cria foco e retorna protocolo', async () => {
    const prisma = makePrisma({ focoId: 'aabbccdd-0000-0000-0000-000000000000' });
    const useCase = new DenunciarCidadaoV2(prisma, makeEnfileirar());

    const result = await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(result.id).toBe('aabbccdd-0000-0000-0000-000000000000');
    expect(result.protocolo).toMatch(/^SENT-\d{4}-[A-F0-9]{6}$/);
    expect(prisma.client.focos_risco.create).toHaveBeenCalledTimes(1);
  });

  it('rate limit excedido — lança 429', async () => {
    const prisma = makePrisma({ rateLimitContagem: 6 });
    const useCase = new DenunciarCidadaoV2(prisma, makeEnfileirar());

    await expect(useCase.execute(makeInput(), 'ip-hash-abc')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(prisma.client.focos_risco.create).not.toHaveBeenCalled();
  });

  it('deduplicação geoespacial — retorna foco existente sem criar novo', async () => {
    const existingId = 'existente-uuid-bbbb-0000-000000000000';
    const prisma = makePrisma({ dedupResult: [{ id: existingId }] });
    const useCase = new DenunciarCidadaoV2(prisma, makeEnfileirar());

    const result = await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(result.id).toBe(existingId);
    expect(prisma.client.focos_risco.create).not.toHaveBeenCalled();
  });

  it('cliente inativo / não encontrado — lança NotFoundException', async () => {
    const prisma = makePrisma({ clienteResult: null as any });
    const useCase = new DenunciarCidadaoV2(prisma, makeEnfileirar());

    await expect(useCase.execute(makeInput(), 'ip-hash-abc')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sem coordenadas — ignora dedup e cria foco normalmente', async () => {
    const prisma = makePrisma({ focoId: 'sem-coord-uuid-0000-0000-000000000000' });
    // Prisma.sql (rate limit) → not array; tagged template (gerarCodigoFoco) → array
    prisma.client.$queryRaw = jest.fn().mockImplementation((...args: any[]) => {
      if (Array.isArray(args[0])) return Promise.resolve([{ ultimo: BigInt(1) }]);
      return Promise.resolve([{ contagem: 1 }]);
    });
    const useCase = new DenunciarCidadaoV2(prisma, makeEnfileirar());

    const result = await useCase.execute(
      makeInput({ latitude: undefined, longitude: undefined }),
      'ip-hash-abc',
    );

    expect(result.id).toBe('sem-coord-uuid-0000-0000-000000000000');
    // 2 chamadas: 1 rate limit + 1 gerarCodigoFoco (dedup ignorado sem coords)
    expect(prisma.client.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('hook EnfileirarNotifCanalCidadao é chamado após criar foco com 7 campos corretos', async () => {
    const prisma = makePrisma({ focoId: 'foco-novo-1111' });
    const enfileirar = makeEnfileirar();
    const useCase = new DenunciarCidadaoV2(prisma, enfileirar);

    await useCase.execute(makeInput({ latitude: -10, longitude: -20 }), 'ip-hash-abc');

    expect(enfileirar.execute).toHaveBeenCalledTimes(1);
    const call = enfileirar.execute.mock.calls[0][0];
    expect(call).toMatchObject({
      focoId: 'foco-novo-1111',
      clienteId: 'cliente-uuid-1111',
      latitude: -10,
      longitude: -20,
      endereco: null,
      origemLevantamentoItemId: null,
    });
    expect(call.suspeitaEm).toBeInstanceOf(Date);
  });

  it('falha no hook EnfileirarNotifCanalCidadao NÃO propaga (best-effort) — retorna sucesso do foco', async () => {
    const prisma = makePrisma({ focoId: 'foco-best-effort' });
    const enfileirar = {
      execute: jest.fn().mockRejectedValue(new Error('job_queue offline')),
    } as any;
    const useCase = new DenunciarCidadaoV2(prisma, enfileirar);

    const result = await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(result.id).toBe('foco-best-effort');
    expect(enfileirar.execute).toHaveBeenCalledTimes(1);
  });

  it('hook NÃO é chamado quando deduplicado (foco já existe)', async () => {
    const existingId = 'dedup-existente-0000-0000-000000000000';
    const prisma = makePrisma({ dedupResult: [{ id: existingId }] });
    const enfileirar = makeEnfileirar();
    const useCase = new DenunciarCidadaoV2(prisma, enfileirar);

    await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(enfileirar.execute).not.toHaveBeenCalled();
  });
});
