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

const mockCliente = { id: 'cliente-uuid-1111', cidade: 'São Paulo', uf: 'SP' };

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
      bairros: {
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

function makeGeocode(result: { lat: number; lng: number } | null = null) {
  return { execute: jest.fn().mockResolvedValue(result) } as any;
}

function makeResolverTerritorio(
  result: {
    bairroId: string | null;
    bairroNome: string | null;
    quadraId: string | null;
    quadraCodigo: string | null;
  } = { bairroId: null, bairroNome: null, quadraId: null, quadraCodigo: null },
) {
  return { execute: jest.fn().mockResolvedValue(result) } as any;
}

function makeResolverAgente(
  result: { agenteId: string | null; agenteNome: string | null } = {
    agenteId: null,
    agenteNome: null,
  },
) {
  return { execute: jest.fn().mockResolvedValue(result) } as any;
}

/** Constrói o use-case com mocks default; cada dependência pode ser sobrescrita. */
function makeUseCase(
  prisma = makePrisma(),
  {
    enfileirar = makeEnfileirar(),
    geocode = makeGeocode(),
    territorio = makeResolverTerritorio(),
    agente = makeResolverAgente(),
  } = {},
) {
  return {
    useCase: new DenunciarCidadaoV2(prisma, enfileirar, geocode, territorio, agente),
    prisma,
    enfileirar,
    geocode,
    territorio,
    agente,
  };
}

describe('DenunciarCidadaoV2', () => {
  it('happy path — cria foco e retorna protocolo', async () => {
    const prisma = makePrisma({ focoId: 'aabbccdd-0000-0000-0000-000000000000' });
    const { useCase } = makeUseCase(prisma);

    const result = await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(result.id).toBe('aabbccdd-0000-0000-0000-000000000000');
    expect(result.protocolo).toMatch(/^SENT-\d{4}-[A-F0-9]{6}$/);
    expect(prisma.client.focos_risco.create).toHaveBeenCalledTimes(1);
  });

  it('rate limit excedido — lança 429', async () => {
    const prisma = makePrisma({ rateLimitContagem: 6 });
    const { useCase } = makeUseCase(prisma);

    await expect(useCase.execute(makeInput(), 'ip-hash-abc')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(prisma.client.focos_risco.create).not.toHaveBeenCalled();
  });

  it('deduplicação geoespacial — retorna foco existente sem criar novo', async () => {
    const existingId = 'existente-uuid-bbbb-0000-000000000000';
    const prisma = makePrisma({ dedupResult: [{ id: existingId }] });
    const { useCase } = makeUseCase(prisma);

    const result = await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(result.id).toBe(existingId);
    expect(prisma.client.focos_risco.create).not.toHaveBeenCalled();
  });

  it('cliente inativo / não encontrado — lança NotFoundException', async () => {
    const prisma = makePrisma({ clienteResult: null as any });
    const { useCase } = makeUseCase(prisma);

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
    const { useCase } = makeUseCase(prisma);

    const result = await useCase.execute(
      makeInput({ latitude: undefined, longitude: undefined }),
      'ip-hash-abc',
    );

    expect(result.id).toBe('sem-coord-uuid-0000-0000-000000000000');
    // 2 chamadas: 1 rate limit + 1 gerarCodigoFoco (dedup ignorado sem coords)
    expect(prisma.client.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('hook EnfileirarNotifCanalCidadao é chamado após criar foco com campos corretos', async () => {
    const prisma = makePrisma({ focoId: 'foco-novo-1111' });
    const { useCase, enfileirar } = makeUseCase(prisma);

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
    const { useCase } = makeUseCase(prisma, { enfileirar });

    const result = await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(result.id).toBe('foco-best-effort');
    expect(enfileirar.execute).toHaveBeenCalledTimes(1);
  });

  it('hook NÃO é chamado quando deduplicado (foco já existe)', async () => {
    const existingId = 'dedup-existente-0000-0000-000000000000';
    const prisma = makePrisma({ dedupResult: [{ id: existingId }] });
    const { useCase, enfileirar } = makeUseCase(prisma, {
      enfileirar: makeEnfileirar(),
    });

    await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(enfileirar.execute).not.toHaveBeenCalled();
  });

  // ── Enriquecimento geográfico ───────────────────────────────────────────────

  it('enriquecimento — lat/long dentro de bairro+quadra grava bairro_id/quadra_id/responsavel_id e payload', async () => {
    const prisma = makePrisma();
    const territorio = makeResolverTerritorio({
      bairroId: 'bairro-1',
      bairroNome: 'Centro',
      quadraId: 'quadra-9',
      quadraCodigo: 'Q09',
    });
    const agente = makeResolverAgente({ agenteId: 'agente-7', agenteNome: 'João Agente' });
    const { useCase, geocode } = makeUseCase(prisma, { territorio, agente });

    await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(geocode.execute).not.toHaveBeenCalled(); // sem endereço digitado → não geocodifica
    expect(territorio.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 'cliente-uuid-1111',
        latitude: -23.5505,
        longitude: -46.6333,
        quadraSnapMetros: [5, 15],
      }),
    );
    expect(agente.execute).toHaveBeenCalledWith('cliente-uuid-1111', 'quadra-9');

    const data = prisma.client.focos_risco.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      bairro_id: 'bairro-1',
      quadra_id: 'quadra-9',
      responsavel_id: 'agente-7',
    });
    expect(data.payload).toMatchObject({
      bairro_nome: 'Centro',
      quadra_codigo: 'Q09',
      agente_sugerido_id: 'agente-7',
      agente_sugerido_nome: 'João Agente',
      geocodificado: false,
    });
  });

  it('enriquecimento — só endereço: geocodifica e então resolve território (geocodificado:true)', async () => {
    const prisma = makePrisma();
    // Sem coords → dedup é pulado; alinha mock: Prisma.sql=rate limit, tagged=gerarCodigoFoco
    prisma.client.$queryRaw = jest.fn().mockImplementation((...args: any[]) => {
      if (Array.isArray(args[0])) return Promise.resolve([{ ultimo: BigInt(1) }]);
      return Promise.resolve([{ contagem: 1 }]);
    });
    const geocode = makeGeocode({ lat: -22.9, lng: -43.2 });
    const territorio = makeResolverTerritorio({
      bairroId: 'bairro-geo',
      bairroNome: 'Bairro Geo',
      quadraId: null,
      quadraCodigo: null,
    });
    const { useCase } = makeUseCase(prisma, { geocode, territorio });

    await useCase.execute(
      makeInput({
        latitude: undefined,
        longitude: undefined,
        endereco: 'Rua das Flores, 100',
      }),
      'ip-hash-abc',
    );

    expect(geocode.execute).toHaveBeenCalledWith('Rua das Flores, 100', 'São Paulo', 'SP');
    expect(territorio.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 'cliente-uuid-1111',
        latitude: -22.9,
        longitude: -43.2,
      }),
    );
    const data = prisma.client.focos_risco.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      latitude: -22.9,
      longitude: -43.2,
      bairro_id: 'bairro-geo',
      endereco_normalizado: 'Rua das Flores, 100',
    });
    expect(data.payload.geocodificado).toBe(true);
  });

  it('enriquecimento — endereço digitado vence o GPS do aparelho (geocodifica mesmo com lat/long)', async () => {
    const prisma = makePrisma();
    const geocode = makeGeocode({ lat: -20.7870666, lng: -51.7114864 });
    const territorio = makeResolverTerritorio({
      bairroId: 'bairro-centro',
      bairroNome: 'Centro',
      quadraId: null,
      quadraCodigo: null,
    });
    const { useCase } = makeUseCase(prisma, { geocode, territorio });

    // GPS do aparelho longe (105 km) + endereço correto digitado
    await useCase.execute(
      makeInput({
        latitude: -20.202367,
        longitude: -50.911117,
        endereco: 'R. Bruno García, 71 - Centro',
      }),
      'ip-hash-abc',
    );

    expect(geocode.execute).toHaveBeenCalledWith(
      'R. Bruno García, 71 - Centro',
      'São Paulo',
      'SP',
    );
    expect(territorio.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 'cliente-uuid-1111',
        latitude: -20.7870666,
        longitude: -51.7114864,
      }),
    );
    const data = prisma.client.focos_risco.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      latitude: -20.7870666,
      longitude: -51.7114864,
      bairro_id: 'bairro-centro',
    });
    expect(data.payload.geocodificado).toBe(true);
  });

  it('enriquecimento — falha em ResolverTerritorio NÃO bloqueia: foco é criado mesmo assim', async () => {
    const prisma = makePrisma({ focoId: 'foco-resiliente' });
    const territorio = {
      execute: jest.fn().mockRejectedValue(new Error('PostGIS indisponível')),
    } as any;
    const { useCase } = makeUseCase(prisma, { territorio });

    const result = await useCase.execute(makeInput(), 'ip-hash-abc');

    expect(result.id).toBe('foco-resiliente');
    expect(prisma.client.focos_risco.create).toHaveBeenCalledTimes(1);
    const data = prisma.client.focos_risco.create.mock.calls[0][0].data;
    // fallback: sem território resolvido, bairro/quadra/responsável ficam nulos
    expect(data.quadra_id).toBeNull();
    expect(data.responsavel_id).toBeNull();
  });
});
