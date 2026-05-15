import { Test } from '@nestjs/testing';
import { REQUEST } from '@nestjs/core';

import { ListarTerritorioAgente } from '../listar-territorio-agente';
import { QuarteiraoReadRepository, TerritorioAgenteQuadra } from '../../repositories/quarteirao-read.repository';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { QuarteiraoException } from '../../errors/quarteirao.exception';

const CLIENTE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const AGENTE_ID  = 'bbbbbbbb-0000-0000-0000-000000000002';

const QUADRAS: TerritorioAgenteQuadra[] = [
  { quadraId: 'q1', codigo: 'Q001', bairroId: 'b1', bairroNome: 'Centro', imoveisCount: 12, geojson: null },
  { quadraId: 'q2', codigo: 'Q002', bairroId: 'b1', bairroNome: 'Centro', imoveisCount:  5, geojson: null },
];

const CICLO_ATIVO_RAW = {
  id:                 'c1',
  numero:             3,
  status:             'ativo',
  data_inicio:        new Date('2026-05-01T00:00:00Z'),
  data_fim_prevista:  new Date('2026-06-30T00:00:00Z'),
};

function makeRequest(userId: string, tenantId: string | null) {
  return { accessScope: { userId, tenantId } };
}

function makeReadRepo(quadras: TerritorioAgenteQuadra[] = QUADRAS) {
  return { findTerritorioAgente: jest.fn().mockResolvedValue(quadras) };
}

function makePrisma(cicloRaw: typeof CICLO_ATIVO_RAW | null = CICLO_ATIVO_RAW) {
  return { client: { ciclos: { findFirst: jest.fn().mockResolvedValue(cicloRaw) } } };
}

async function buildUc(
  req: Record<string, unknown>,
  readRepo = makeReadRepo(),
  prismaMock = makePrisma(),
) {
  const mod = await Test.createTestingModule({
    providers: [
      ListarTerritorioAgente,
      { provide: QuarteiraoReadRepository, useValue: readRepo },
      { provide: PrismaService,            useValue: prismaMock },
      { provide: REQUEST,                  useValue: req },
    ],
  }).compile();

  return mod.resolve<ListarTerritorioAgente>(ListarTerritorioAgente, undefined, { strict: false });
}

describe('ListarTerritorioAgente', () => {
  it('retorna quadras + cicloAtivo quando agente tem território e ciclo ativo', async () => {
    const uc = await buildUc(makeRequest(AGENTE_ID, CLIENTE_ID));
    const result = await uc.execute();

    expect(result.agenteId).toBe(AGENTE_ID);
    expect(result.quadras).toHaveLength(2);
    expect(result.quadras[0].codigo).toBe('Q001');
    expect(result.quadras[0].imoveisCount).toBe(12);
    expect(result.cicloAtivo?.id).toBe('c1');
    expect(result.cicloAtivo?.numero).toBe(3);
  });

  it('retorna quadras com cicloAtivo null quando não há ciclo ativo', async () => {
    const uc = await buildUc(makeRequest(AGENTE_ID, CLIENTE_ID), makeReadRepo(), makePrisma(null));
    const result = await uc.execute();

    expect(result.quadras).toHaveLength(2);
    expect(result.cicloAtivo).toBeNull();
  });

  it('retorna lista vazia quando agente não tem território fixo', async () => {
    const uc = await buildUc(makeRequest(AGENTE_ID, CLIENTE_ID), makeReadRepo([]), makePrisma(null));
    const result = await uc.execute();

    expect(result.quadras).toHaveLength(0);
    expect(result.cicloAtivo).toBeNull();
  });

  it('lança badRequest quando tenantId está ausente (admin sem clienteId)', async () => {
    const uc = await buildUc(makeRequest(AGENTE_ID, null));
    await expect(uc.execute()).rejects.toThrow();
  });

  it('passa o agenteId correto (userId do JWT) para findTerritorioAgente', async () => {
    const readRepo = makeReadRepo();
    const uc = await buildUc(makeRequest(AGENTE_ID, CLIENTE_ID), readRepo);
    await uc.execute();

    expect(readRepo.findTerritorioAgente).toHaveBeenCalledWith(CLIENTE_ID, AGENTE_ID);
  });

  it('inclui imoveisCount=0 quando quadra não tem imóveis', async () => {
    const semImoveis = [
      { quadraId: 'q3', codigo: 'Q003', bairroId: null, bairroNome: null, imoveisCount: 0, geojson: null },
    ];
    const uc = await buildUc(makeRequest(AGENTE_ID, CLIENTE_ID), makeReadRepo(semImoveis));
    const result = await uc.execute();

    expect(result.quadras[0].imoveisCount).toBe(0);
  });

  it('cicloAtivo serializa datas como ISO string', async () => {
    const uc = await buildUc(makeRequest(AGENTE_ID, CLIENTE_ID));
    const result = await uc.execute();

    expect(result.cicloAtivo?.dataInicio).toBe('2026-05-01T00:00:00.000Z');
    expect(result.cicloAtivo?.dataFimPrevista).toBe('2026-06-30T00:00:00.000Z');
  });
});
