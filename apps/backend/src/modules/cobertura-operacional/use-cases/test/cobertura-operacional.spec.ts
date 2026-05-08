import { Test } from '@nestjs/testing';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { GetCoberturaAgentesUc } from '../get-cobertura-agentes';
import { GetCoberturaQuarteiroesSUc } from '../get-cobertura-quarteiroes';
import { GetImoveisNuncaVisitadosUc } from '../get-imoveis-nunca-visitados';
import { GetResumoCoberturaUc } from '../get-resumo-cobertura';

const CLIENT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

function buildPrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    client: {
      ciclos: { findFirst: jest.fn().mockResolvedValue(null) },
      imoveis: { count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      ...overrides,
    },
  };
}

describe('GetResumoCoberturaUc', () => {
  let uc: GetResumoCoberturaUc;
  let prismaMock: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        GetResumoCoberturaUc,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    uc = module.get(GetResumoCoberturaUc);
  });

  it('retorna zero-state quando não há ciclo ativo', async () => {
    prismaMock.client.imoveis.count.mockResolvedValue(10);
    const result = await uc.execute(CLIENT_ID);
    expect(result.ciclo).toBeNull();
    expect(result.municipio.totalImoveis).toBe(10);
    expect(result.municipio.totalVisitados).toBe(0);
    expect(result.quarteiroes.total).toBe(0);
    expect(result.agentes.total).toBe(0);
  });

  it('retorna dados quando há ciclo ativo', async () => {
    prismaMock.client.ciclos.findFirst.mockResolvedValue({ id: 'ciclo-1', numero: 1, ano: 2026 });
    prismaMock.client.imoveis.count.mockResolvedValue(100);
    prismaMock.client.$queryRaw
      .mockResolvedValueOnce([{ total: 80 }])
      .mockResolvedValueOnce([{ total: 5, cobertos: 3, parcial: 1, sem_cobertura: 1 }])
      .mockResolvedValueOnce([{ total: 3, com_cobertura: 2 }])
      .mockResolvedValueOnce([{ total: 20 }])
      .mockResolvedValueOnce([{ total: 1 }]);

    const result = await uc.execute(CLIENT_ID);
    expect(result.ciclo?.numero).toBe(1);
    expect(result.municipio.totalImoveis).toBe(100);
    expect(result.municipio.totalVisitados).toBe(80);
    expect(result.municipio.percentualCobertura).toBe(80);
    expect(result.quarteiroes.cobertos).toBe(3);
    expect(result.agentes.semCobertura).toBe(1);
    expect(result.indicadores.imoveisNuncaVisitados).toBe(20);
    expect(result.indicadores.quarteiroesNuncaVisitados).toBe(1);
  });
});

describe('GetCoberturaQuarteiroesSUc', () => {
  let uc: GetCoberturaQuarteiroesSUc;
  let prismaMock: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        GetCoberturaQuarteiroesSUc,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    uc = module.get(GetCoberturaQuarteiroesSUc);
  });

  it('retorna [] quando não há ciclo ativo', async () => {
    const result = await uc.execute(CLIENT_ID);
    expect(result).toEqual([]);
  });

  it('mapeia status corretamente', async () => {
    prismaMock.client.ciclos.findFirst.mockResolvedValue({ numero: 1 });
    prismaMock.client.$queryRaw.mockResolvedValue([
      { quarteirao: 'Q01', total_imoveis: 10, visitados: 10 },
      { quarteirao: 'Q02', total_imoveis: 10, visitados: 5 },
      { quarteirao: 'Q03', total_imoveis: 10, visitados: 0 },
    ]);

    const result = await uc.execute(CLIENT_ID);
    expect(result).toHaveLength(3);
    expect(result[0].status).toBe('coberto');
    expect(result[1].status).toBe('parcial');
    expect(result[2].status).toBe('sem_cobertura');
    expect(result[0].percentualCobertura).toBe(100);
    expect(result[1].percentualCobertura).toBe(50);
  });
});

describe('GetCoberturaAgentesUc', () => {
  let uc: GetCoberturaAgentesUc;
  let prismaMock: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        GetCoberturaAgentesUc,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    uc = module.get(GetCoberturaAgentesUc);
  });

  it('retorna [] quando não há ciclo ativo', async () => {
    expect(await uc.execute(CLIENT_ID)).toEqual([]);
  });

  it('calcula pendentes corretamente', async () => {
    prismaMock.client.ciclos.findFirst.mockResolvedValue({ numero: 1 });
    prismaMock.client.$queryRaw.mockResolvedValue([
      { agente_id: 'ag-1', nome: 'Ana', total_imoveis: 20, visitados: 15 },
    ]);

    const [ag] = await uc.execute(CLIENT_ID);
    expect(ag.pendentes).toBe(5);
    expect(ag.percentualCobertura).toBe(75);
  });
});

describe('GetImoveisNuncaVisitadosUc', () => {
  let uc: GetImoveisNuncaVisitadosUc;
  let prismaMock: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        GetImoveisNuncaVisitadosUc,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    uc = module.get(GetImoveisNuncaVisitadosUc);
  });

  it('retorna lista vazia quando não há imóveis nunca visitados', async () => {
    expect(await uc.execute(CLIENT_ID)).toEqual([]);
  });

  it('mapeia campos corretamente incluindo diasSemVistoria', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([
      {
        id: 'im-1',
        logradouro: 'Rua A',
        numero: '10',
        bairro: 'Centro',
        quarteirao: 'Q01',
        agente_id: 'ag-1',
        agente_nome: 'João',
        dias_sem_vistoria: '120',
      },
    ]);

    const [item] = await uc.execute(CLIENT_ID);
    expect(item.id).toBe('im-1');
    expect(item.agenteNome).toBe('João');
    expect(item.diasSemVistoria).toBe(120);
  });

  it('funciona sem ciclo ativo (usa cicloNum=null)', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([]);
    const result = await uc.execute(CLIENT_ID);
    expect(result).toEqual([]);
    expect(prismaMock.client.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
