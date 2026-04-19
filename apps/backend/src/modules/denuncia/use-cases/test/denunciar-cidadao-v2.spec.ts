import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
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
        .mockResolvedValueOnce(dedupResult),
      $executeRaw: Object.assign(jest.fn().mockResolvedValue(1), {
        catch: jest.fn(),
      }),
    },
  } as any;
}

describe('DenunciarCidadaoV2', () => {
  it('happy path — cria foco e retorna protocolo', async () => {
    const prisma = makePrisma({ focoId: 'aabbccdd-0000-0000-0000-000000000000' });
    const useCase = new DenunciarCidadaoV2(prisma);

    const result = await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(result.id).toBe('aabbccdd-0000-0000-0000-000000000000');
    expect(result.protocolo).toBe('aabbccdd');
    expect(prisma.client.focos_risco.create).toHaveBeenCalledTimes(1);
  });

  it('rate limit excedido — lança 429', async () => {
    const prisma = makePrisma({ rateLimitContagem: 6 });
    const useCase = new DenunciarCidadaoV2(prisma);

    await expect(useCase.execute(makeInput(), 'ip-hash-abc')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(prisma.client.focos_risco.create).not.toHaveBeenCalled();
  });

  it('deduplicação geoespacial — retorna foco existente sem criar novo', async () => {
    const existingId = 'existente-uuid-bbbb-0000-000000000000';
    const prisma = makePrisma({ dedupResult: [{ id: existingId }] });
    const useCase = new DenunciarCidadaoV2(prisma);

    const result = await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(result.id).toBe(existingId);
    expect(prisma.client.focos_risco.create).not.toHaveBeenCalled();
  });

  it('cliente inativo / não encontrado — lança NotFoundException', async () => {
    // null (não undefined) para contornar o default de destructuring do makePrisma
    const prisma = makePrisma({ clienteResult: null as any });
    const useCase = new DenunciarCidadaoV2(prisma);

    await expect(useCase.execute(makeInput(), 'ip-hash-abc')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sem coordenadas — ignora dedup e cria foco normalmente', async () => {
    const prisma = makePrisma({ focoId: 'sem-coord-uuid-0000-0000-000000000000' });
    // $queryRaw só é chamado para rate-limit (sem dedup)
    prisma.client.$queryRaw = jest.fn().mockResolvedValue([{ contagem: 1 }]);
    const useCase = new DenunciarCidadaoV2(prisma);

    const result = await useCase.execute(
      makeInput({ latitude: undefined, longitude: undefined }),
      'ip-hash-abc',
    );

    expect(result.id).toBe('sem-coord-uuid-0000-0000-000000000000');
    // queryRaw chamado 1x (rate limit), NÃO 2x (sem dedup)
    expect(prisma.client.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
