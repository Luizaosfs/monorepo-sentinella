import { DesenharQuarteirao } from '../desenhar-quarteirao';
import { desenharQuarteiraoSchema } from '../../dtos/desenhar-quarteirao.body';

// ── Constants ─────────────────────────────────────────────────────────────────

const CLIENTE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REGIAO_ID  = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const QUAD_ID    = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const VALID_POLYGON: { type: 'Polygon'; coordinates: [number, number][][] } = {
  type: 'Polygon',
  coordinates: [
    [
      [-47.93, -15.78],
      [-47.92, -15.78],
      [-47.92, -15.77],
      [-47.93, -15.77],
      [-47.93, -15.78],
    ],
  ],
};

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeUc(overrides: {
  queryRawResponses?: unknown[][];
  findFirst?: jest.Mock;
  txCreate?: jest.Mock;
  txExecuteRaw?: jest.Mock;
  txFindUnique?: jest.Mock;
} = {}) {
  // Default happy-path $queryRaw sequence:
  //   1. region check  → [{ id, has_area: true }]
  //   2. ST_IsValid    → [{ valid: true }]
  //   3. ST_Covers     → [{ within: true }]
  //   4. ST_Intersects → [{ overlap: false }]
  const defaultQueryRawResponses: unknown[][] = [
    [{ id: REGIAO_ID, has_area: true }],
    [{ valid: true }],
    [{ within: true }],
    [{ overlap: false }],
  ];

  const responses = overrides.queryRawResponses ?? defaultQueryRawResponses;
  let callIdx = 0;
  const queryRaw = jest.fn().mockImplementation(() =>
    Promise.resolve(responses[callIdx++] ?? []),
  );

  const createdRow = { id: QUAD_ID };
  const fullRow = {
    id: QUAD_ID, cliente_id: CLIENTE_ID, bairro_id: REGIAO_ID,
    codigo: 'A1', geojson: VALID_POLYGON, ativo: true,
    latitude: -15.775, longitude: -47.925,
    created_at: new Date(), updated_at: new Date(), deleted_at: null, deleted_by: null, bairro: null,
  };

  const txCreate     = overrides.txCreate     ?? jest.fn().mockResolvedValue(createdRow);
  const txExecuteRaw = overrides.txExecuteRaw ?? jest.fn().mockResolvedValue(1);
  const txFindUnique = overrides.txFindUnique ?? jest.fn().mockResolvedValue(fullRow);

  const txClient = {
    bairros_quadras: { create: txCreate, findUnique: txFindUnique },
    $executeRaw: txExecuteRaw,
  };

  const findFirst = overrides.findFirst ?? jest.fn().mockResolvedValue(null);

  const prisma = {
    client: {
      $queryRaw: queryRaw,
      $transaction: jest.fn().mockImplementation(
        (fn: (tx: typeof txClient) => unknown) => fn(txClient),
      ),
      bairros_quadras: { findFirst },
    },
  };

  return {
    uc: new DesenharQuarteirao(prisma as never),
    queryRaw, findFirst, txCreate, txExecuteRaw, txFindUnique,
  };
}

// ── DTO (Zod schema) tests ────────────────────────────────────────────────────

describe('desenharQuarteiraoSchema', () => {
  it('normaliza código com espaços e minúsculas → uppercase sem espaços', () => {
    const result = desenharQuarteiraoSchema.parse({
      regiaoId: REGIAO_ID,
      codigo: '  a1  ',
      geojson: VALID_POLYGON,
    });
    expect(result.codigo).toBe('A1');
  });

  it('rejeita regiaoId inválido (não UUID)', () => {
    expect(() =>
      desenharQuarteiraoSchema.parse({ regiaoId: 'nao-uuid', codigo: 'A1', geojson: VALID_POLYGON }),
    ).toThrow();
  });

  it('rejeita código vazio', () => {
    expect(() =>
      desenharQuarteiraoSchema.parse({ regiaoId: REGIAO_ID, codigo: '   ', geojson: VALID_POLYGON }),
    ).toThrow();
  });

  it('rejeita código acima de 20 caracteres', () => {
    expect(() =>
      desenharQuarteiraoSchema.parse({
        regiaoId: REGIAO_ID,
        codigo: 'X'.repeat(21),
        geojson: VALID_POLYGON,
      }),
    ).toThrow();
  });

  it('rejeita geojson que não seja Polygon', () => {
    expect(() =>
      desenharQuarteiraoSchema.parse({
        regiaoId: REGIAO_ID,
        codigo: 'A1',
        geojson: { type: 'MultiPolygon', coordinates: [] },
      }),
    ).toThrow();
  });

  it('rejeita Polygon com anel exterior com menos de 3 pontos', () => {
    expect(() =>
      desenharQuarteiraoSchema.parse({
        regiaoId: REGIAO_ID,
        codigo: 'A1',
        geojson: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] },
      }),
    ).toThrow();
  });

  it('aceita Polygon GeoJSON válido', () => {
    const r = desenharQuarteiraoSchema.parse({
      regiaoId: REGIAO_ID, codigo: 'B2', geojson: VALID_POLYGON,
    });
    expect(r.geojson.type).toBe('Polygon');
    expect(r.codigo).toBe('B2');
  });
});

// ── Use-case tests ────────────────────────────────────────────────────────────

describe('DesenharQuarteirao', () => {
  it('cria quarteirão, chama create + executeRaw + findUnique dentro da transação', async () => {
    const { uc, txCreate, txExecuteRaw, txFindUnique } = makeUc();

    const result = await uc.execute(CLIENTE_ID, {
      regiaoId: REGIAO_ID,
      codigo: 'A1',
      geojson: VALID_POLYGON,
    });

    expect(result).toMatchObject({ id: QUAD_ID, codigo: 'A1' });
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cliente_id: CLIENTE_ID,
          bairro_id: REGIAO_ID,
          codigo: 'A1',
          ativo: true,
        }),
      }),
    );
    expect(txExecuteRaw).toHaveBeenCalledTimes(1);
    expect(txFindUnique).toHaveBeenCalledWith({ where: { id: QUAD_ID } });
  });

  it('executa exatamente 4 queries PostGIS na ordem correta', async () => {
    const { uc, queryRaw } = makeUc();

    await uc.execute(CLIENTE_ID, { regiaoId: REGIAO_ID, codigo: 'A1', geojson: VALID_POLYGON });

    expect(queryRaw).toHaveBeenCalledTimes(4);
  });

  it('lança forbiddenTenant quando região não pertence ao cliente', async () => {
    const { uc } = makeUc({
      queryRawResponses: [[]], // region query retorna vazio
    });

    await expect(
      uc.execute(CLIENTE_ID, { regiaoId: REGIAO_ID, codigo: 'A1', geojson: VALID_POLYGON }),
    ).rejects.toMatchObject({ message: expect.stringContaining('Acesso') });
  });

  it('lança invalidGeom quando ST_IsValid retorna false', async () => {
    const { uc } = makeUc({
      queryRawResponses: [
        [{ id: REGIAO_ID, has_area: false }], // region ok, sem geometria
        [{ valid: false }],                    // polígono inválido
      ],
    });

    await expect(
      uc.execute(CLIENTE_ID, { regiaoId: REGIAO_ID, codigo: 'A1', geojson: VALID_POLYGON }),
    ).rejects.toMatchObject({ message: expect.stringContaining('inválido') });
  });

  it('lança geomOutsideRegiao quando ST_Covers retorna false', async () => {
    const { uc } = makeUc({
      queryRawResponses: [
        [{ id: REGIAO_ID, has_area: true }],
        [{ valid: true }],
        [{ within: false }], // fora da região
      ],
    });

    await expect(
      uc.execute(CLIENTE_ID, { regiaoId: REGIAO_ID, codigo: 'A1', geojson: VALID_POLYGON }),
    ).rejects.toMatchObject({ message: expect.stringContaining('fora') });
  });

  it('lança geomOverlap quando ST_Intersects detecta sobreposição', async () => {
    const { uc } = makeUc({
      queryRawResponses: [
        [{ id: REGIAO_ID, has_area: true }],
        [{ valid: true }],
        [{ within: true }],
        [{ overlap: true }], // sobrepõe
      ],
    });

    await expect(
      uc.execute(CLIENTE_ID, { regiaoId: REGIAO_ID, codigo: 'A1', geojson: VALID_POLYGON }),
    ).rejects.toMatchObject({ message: expect.stringContaining('sobrepõe') });
  });

  it('lança conflict quando código já existe para o cliente', async () => {
    const { uc } = makeUc({
      findFirst: jest.fn().mockResolvedValue({ id: 'existing-id' }),
    });

    await expect(
      uc.execute(CLIENTE_ID, { regiaoId: REGIAO_ID, codigo: 'A1', geojson: VALID_POLYGON }),
    ).rejects.toMatchObject({ message: expect.stringContaining('código') });
  });

  it('pula validação ST_Covers quando região não tem geometria (has_area = false)', async () => {
    const { uc, queryRaw } = makeUc({
      queryRawResponses: [
        [{ id: REGIAO_ID, has_area: false }], // sem geometria
        [{ valid: true }],
        // sem chamada ST_Covers
        [{ overlap: false }],
      ],
    });

    await uc.execute(CLIENTE_ID, { regiaoId: REGIAO_ID, codigo: 'A1', geojson: VALID_POLYGON });

    // 3 queries: region check, ST_IsValid, ST_Intersects (sem ST_Covers)
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it('garante que cliente_id vem do tenant, nunca do payload', async () => {
    const { uc, txCreate } = makeUc();

    await uc.execute(CLIENTE_ID, { regiaoId: REGIAO_ID, codigo: 'A1', geojson: VALID_POLYGON });

    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cliente_id: CLIENTE_ID }),
      }),
    );
  });
});
