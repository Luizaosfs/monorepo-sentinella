import { Test } from '@nestjs/testing';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { GetReincidenciaBairrosUc } from '../get-reincidencia-bairros';
import { GetReincidenciaImoveisUc } from '../get-reincidencia-imoveis';
import { GetReincidenciaQuarteiroesuUc } from '../get-reincidencia-quarteiroes';
import { GetResumoReincidenciaUc } from '../get-resumo-reincidencia';
import { calcularCriticidadeAgregado, calcularCriticidadeImovel, parsePeriodo } from '../../view-model/reincidencia.vm';

const CLIENT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

function buildMock(queryRawResult: unknown[] = []) {
  return {
    client: {
      $queryRaw: jest.fn().mockResolvedValue(queryRawResult),
    },
  };
}

// ── helpers puros ────────────────────────────────────────────────────────────

describe('calcularCriticidadeImovel', () => {
  it('baixa para 2 ocorrências', () => expect(calcularCriticidadeImovel(2)).toBe('baixa'));
  it('media para 3 ocorrências', () => expect(calcularCriticidadeImovel(3)).toBe('media'));
  it('alta para 4 ocorrências', () => expect(calcularCriticidadeImovel(4)).toBe('alta'));
  it('alta para 10 ocorrências', () => expect(calcularCriticidadeImovel(10)).toBe('alta'));
});

describe('calcularCriticidadeAgregado', () => {
  it('baixa para 1 imóvel reincidente', () => expect(calcularCriticidadeAgregado(1)).toBe('baixa'));
  it('media para 2 imóveis reincidentes', () => expect(calcularCriticidadeAgregado(2)).toBe('media'));
  it('media para 3 imóveis reincidentes', () => expect(calcularCriticidadeAgregado(3)).toBe('media'));
  it('alta para 4+ imóveis reincidentes', () => expect(calcularCriticidadeAgregado(4)).toBe('alta'));
});

describe('parsePeriodo', () => {
  it('usa últimos 90 dias quando não há parâmetros', () => {
    const { inicio, fim } = parsePeriodo();
    const diff = fim.getTime() - inicio.getTime();
    const diffDays = Math.round(diff / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(90);
  });

  it('usa datas fornecidas quando presentes', () => {
    const { inicio, fim } = parsePeriodo('2026-01-01', '2026-03-31');
    expect(inicio.toISOString().startsWith('2026-01-01')).toBe(true);
    expect(fim.toISOString().startsWith('2026-03-31')).toBe(true);
  });
});

// ── GetResumoReincidenciaUc ──────────────────────────────────────────────────

describe('GetResumoReincidenciaUc', () => {
  let uc: GetResumoReincidenciaUc;
  let prismaMock: ReturnType<typeof buildMock>;

  beforeEach(async () => {
    prismaMock = buildMock();
    const module = await Test.createTestingModule({
      providers: [
        GetResumoReincidenciaUc,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    uc = module.get(GetResumoReincidenciaUc);
  });

  it('retorna zeros quando não há focos', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([{
      total_ocorrencias: 0, total_imoveis_com_foco: 0,
      imoveis_reincidentes: 0, quarteiroes_reincidentes: 0,
      bairros_reincidentes: 0, crit_baixa: 0, crit_media: 0, crit_alta: 0,
    }]);
    const result = await uc.execute(CLIENT_ID);
    expect(result.municipio.imoveisReincidentes).toBe(0);
    expect(result.municipio.percentualReincidencia).toBe(0);
    expect(result.criticidade).toEqual({ baixa: 0, media: 0, alta: 0 });
  });

  it('período padrão é 90 dias quando não informado', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([{
      total_ocorrencias: 0, total_imoveis_com_foco: 0,
      imoveis_reincidentes: 0, quarteiroes_reincidentes: 0,
      bairros_reincidentes: 0, crit_baixa: 0, crit_media: 0, crit_alta: 0,
    }]);
    const result = await uc.execute(CLIENT_ID);
    const inicio = new Date(result.periodo.dataInicio);
    const fim = new Date(result.periodo.dataFim);
    const diffDays = Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(90);
  });

  it('calcula percentualReincidencia corretamente', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([{
      total_ocorrencias: 10, total_imoveis_com_foco: 8,
      imoveis_reincidentes: 4, quarteiroes_reincidentes: 2,
      bairros_reincidentes: 1, crit_baixa: 2, crit_media: 1, crit_alta: 1,
    }]);
    const result = await uc.execute(CLIENT_ID);
    expect(result.municipio.percentualReincidencia).toBe(50); // 4/8 * 100
    expect(result.criticidade.baixa).toBe(2);
    expect(result.criticidade.media).toBe(1);
    expect(result.criticidade.alta).toBe(1);
  });

  it('usa clienteId como tenant isolation (não mistura dados)', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([{
      total_ocorrencias: 0, total_imoveis_com_foco: 0,
      imoveis_reincidentes: 0, quarteiroes_reincidentes: 0,
      bairros_reincidentes: 0, crit_baixa: 0, crit_media: 0, crit_alta: 0,
    }]);
    await uc.execute(CLIENT_ID);
    await uc.execute(OTHER_ID);
    const calls = prismaMock.client.$queryRaw.mock.calls;
    expect(calls[0][0].values).toContain(CLIENT_ID);
    expect(calls[1][0].values).toContain(OTHER_ID);
  });
});

// ── GetReincidenciaImoveisUc ─────────────────────────────────────────────────

describe('GetReincidenciaImoveisUc', () => {
  let uc: GetReincidenciaImoveisUc;
  let prismaMock: ReturnType<typeof buildMock>;

  beforeEach(async () => {
    prismaMock = buildMock([]);
    const module = await Test.createTestingModule({
      providers: [
        GetReincidenciaImoveisUc,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    uc = module.get(GetReincidenciaImoveisUc);
  });

  it('retorna lista vazia quando não há reincidentes', async () => {
    expect(await uc.execute(CLIENT_ID)).toEqual([]);
  });

  it('imóvel com 2 ocorrências é baixa', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([{
      imovel_id: 'im-1', endereco: 'Rua A, 10',
      bairro: 'Centro', quarteirao: 'Q01',
      total_ocorrencias: '2', ultimo_foco_em: new Date(),
    }]);
    const [item] = await uc.execute(CLIENT_ID);
    expect(item.criticidade).toBe('baixa');
    expect(item.totalOcorrencias).toBe(2);
  });

  it('imóvel com 3 ocorrências é media', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([{
      imovel_id: 'im-1', endereco: 'Rua A, 10',
      bairro: 'Centro', quarteirao: 'Q01',
      total_ocorrencias: '3', ultimo_foco_em: new Date(),
    }]);
    const [item] = await uc.execute(CLIENT_ID);
    expect(item.criticidade).toBe('media');
  });

  it('imóvel com 4+ ocorrências é alta', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([{
      imovel_id: 'im-1', endereco: 'Rua A, 10',
      bairro: 'Centro', quarteirao: 'Q01',
      total_ocorrencias: '5', ultimo_foco_em: new Date(),
    }]);
    const [item] = await uc.execute(CLIENT_ID);
    expect(item.criticidade).toBe('alta');
  });

  it('não contar foco descartado — query usa status <> descartado', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([]);
    await uc.execute(CLIENT_ID);
    const sqlObj = prismaMock.client.$queryRaw.mock.calls[0][0] as { strings: string[] };
    const sqlStr = sqlObj.strings.join('');
    expect(sqlStr).toContain('descartado');
  });
});

// ── GetReincidenciaQuarteiroesuUc ────────────────────────────────────────────

describe('GetReincidenciaQuarteiroesuUc', () => {
  let uc: GetReincidenciaQuarteiroesuUc;
  let prismaMock: ReturnType<typeof buildMock>;

  beforeEach(async () => {
    prismaMock = buildMock([]);
    const module = await Test.createTestingModule({
      providers: [
        GetReincidenciaQuarteiroesuUc,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    uc = module.get(GetReincidenciaQuarteiroesuUc);
  });

  it('retorna lista vazia quando não há quarteirões reincidentes', async () => {
    expect(await uc.execute(CLIENT_ID)).toEqual([]);
  });

  it('calcula criticidade por quarteirão baseado em imoveis_reincidentes', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([{
      quarteirao: 'Q01', bairro: 'Centro',
      total_ocorrencias: '8', imoveis_reincidentes: '4',
      ultimo_foco_em: new Date(),
    }]);
    const [q] = await uc.execute(CLIENT_ID);
    expect(q.criticidade).toBe('alta');
    expect(q.imoveisReincidentes).toBe(4);
  });
});

// ── GetReincidenciaBairrosUc ─────────────────────────────────────────────────

describe('GetReincidenciaBairrosUc', () => {
  let uc: GetReincidenciaBairrosUc;
  let prismaMock: ReturnType<typeof buildMock>;

  beforeEach(async () => {
    prismaMock = buildMock([]);
    const module = await Test.createTestingModule({
      providers: [
        GetReincidenciaBairrosUc,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    uc = module.get(GetReincidenciaBairrosUc);
  });

  it('retorna lista vazia quando não há bairros reincidentes', async () => {
    expect(await uc.execute(CLIENT_ID)).toEqual([]);
  });

  it('mapeia campos corretamente incluindo quarteiroesReincidentes', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([{
      bairro: 'Centro',
      total_ocorrencias: '12', imoveis_reincidentes: '5',
      quarteiroes_reincidentes: '3', ultimo_foco_em: new Date(),
    }]);
    const [b] = await uc.execute(CLIENT_ID);
    expect(b.bairro).toBe('Centro');
    expect(b.quarteiroesReincidentes).toBe(3);
    expect(b.criticidade).toBe('alta');
  });

  it('proteção cross-tenant: cada chamada usa seu clienteId', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([]);
    await uc.execute(CLIENT_ID);
    await uc.execute(OTHER_ID);
    const calls = prismaMock.client.$queryRaw.mock.calls;
    expect(calls[0][0].values).toContain(CLIENT_ID);
    expect(calls[1][0].values).toContain(OTHER_ID);
  });
});
