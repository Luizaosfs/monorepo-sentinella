import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  calcularSeveridadeGeral,
  gerarJustificativas,
  gerarRecomendacao,
} from '../../view-model/alerta-territorial.vm';
import { GetAlertaTerritorial } from '../get-alerta-territorial';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<{
  regiao_id: string;
  regiao_nome: string;
  nivel_risco: string;
  chuva_24h: number;
  chuva_72h: number;
  chuva_7d: number;
  tendencia: string | null;
  situacao_ambiental: string | null;
}> = {}) {
  return {
    regiao_id: 'r1',
    regiao_nome: 'Norte',
    nivel_risco: 'medio',
    chuva_24h: 10,
    chuva_72h: 25,
    chuva_7d: 40,
    tendencia: null,
    situacao_ambiental: null,
    dt_ref: '2026-05-08',
    ...overrides,
  };
}

// ── GetAlertaTerritorial use-case ─────────────────────────────────────────────

describe('GetAlertaTerritorial', () => {
  let useCase: GetAlertaTerritorial;
  const mockQueryRaw = jest.fn();

  const prismaMock = {
    client: { $queryRaw: mockQueryRaw },
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAlertaTerritorial,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    useCase = module.get(GetAlertaTerritorial);
  });

  it('filtra por clienteId (tenant isolation)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await useCase.execute('tenant-abc');
    const sql: string = mockQueryRaw.mock.calls[0][0].strings.join('');
    expect(sql).toContain('cliente_id');
    expect(sql).toContain('regiao_id');
  });

  it('retorna totalRegioesMonitoradas=0 e alertas=[] quando não há dados', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const result = await useCase.execute('c1');
    expect(result.totalRegioesMonitoradas).toBe(0);
    expect(result.totalRegioesEmAlerta).toBe(0);
    expect(result.alertas).toEqual([]);
    expect(result.severidadeGeral).toBe('baixo');
  });

  it('exclui regiões com nivel_risco=baixo dos alertas', async () => {
    mockQueryRaw.mockResolvedValue([
      makeRow({ nivel_risco: 'baixo' }),
      makeRow({ regiao_id: 'r2', regiao_nome: 'Sul', nivel_risco: 'medio' }),
    ]);
    const result = await useCase.execute('c1');
    expect(result.totalRegioesMonitoradas).toBe(2);
    expect(result.totalRegioesEmAlerta).toBe(1);
    expect(result.alertas[0].regiaoId).toBe('r2');
  });

  it('inclui medio, alto e critico nos alertas', async () => {
    mockQueryRaw.mockResolvedValue([
      makeRow({ regiao_id: 'r1', nivel_risco: 'medio' }),
      makeRow({ regiao_id: 'r2', nivel_risco: 'alto' }),
      makeRow({ regiao_id: 'r3', nivel_risco: 'critico' }),
    ]);
    const result = await useCase.execute('c1');
    expect(result.totalRegioesEmAlerta).toBe(3);
  });

  it('ordena alertas por severidade desc (critico > alto > medio)', async () => {
    mockQueryRaw.mockResolvedValue([
      makeRow({ regiao_id: 'r1', nivel_risco: 'medio' }),
      makeRow({ regiao_id: 'r2', nivel_risco: 'critico' }),
      makeRow({ regiao_id: 'r3', nivel_risco: 'alto' }),
    ]);
    const { alertas } = await useCase.execute('c1');
    expect(alertas[0].nivelRiscoPluvio).toBe('critico');
    expect(alertas[1].nivelRiscoPluvio).toBe('alto');
    expect(alertas[2].nivelRiscoPluvio).toBe('medio');
  });

  it('severidadeGeral = maior nível entre alertas', async () => {
    mockQueryRaw.mockResolvedValue([
      makeRow({ nivel_risco: 'medio' }),
      makeRow({ regiao_id: 'r2', nivel_risco: 'alto' }),
    ]);
    const result = await useCase.execute('c1');
    expect(result.severidadeGeral).toBe('alto');
  });

  it('não cria foco nem SLA — execute é read-only', async () => {
    mockQueryRaw.mockResolvedValue([makeRow({ nivel_risco: 'critico' })]);
    const result = await useCase.execute('c1');
    expect(result.alertas[0]).not.toHaveProperty('focoId');
    expect(result.alertas[0]).not.toHaveProperty('slaId');
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('gera recomendação correta por nível', async () => {
    mockQueryRaw.mockResolvedValue([makeRow({ nivel_risco: 'critico', chuva_24h: 35 })]);
    const { alertas } = await useCase.execute('c1');
    expect(alertas[0].recomendacao).toBe('Priorizar vistoria preventiva nas próximas 24h');
  });

  it('gera justificativas baseadas nos dados', async () => {
    mockQueryRaw.mockResolvedValue([
      makeRow({ nivel_risco: 'critico', chuva_24h: 35, tendencia: 'crescente' }),
    ]);
    const { alertas } = await useCase.execute('c1');
    expect(alertas[0].justificativas.length).toBeGreaterThan(0);
    expect(alertas[0].justificativas.some((j) => j.includes('24h'))).toBe(true);
  });
});

// ── ViewModel puras ───────────────────────────────────────────────────────────

describe('calcularSeveridadeGeral', () => {
  it('retorna baixo para array vazio', () => expect(calcularSeveridadeGeral([])).toBe('baixo'));
  it('retorna critico se houver critico', () => expect(calcularSeveridadeGeral(['medio', 'critico', 'alto'])).toBe('critico'));
  it('retorna alto sem critico', () => expect(calcularSeveridadeGeral(['medio', 'alto'])).toBe('alto'));
});

describe('gerarRecomendacao', () => {
  it('critico → 24h', () => expect(gerarRecomendacao('critico')).toContain('24h'));
  it('alto → 48h',    () => expect(gerarRecomendacao('alto')).toContain('48h'));
  it('medio → monitorar', () => expect(gerarRecomendacao('medio')).toContain('Monitorar'));
  it('baixo → sem ação', () => expect(gerarRecomendacao('baixo')).toContain('Sem ação'));
});

describe('gerarJustificativas', () => {
  const base = { chuva_24h: 0, chuva_72h: 0, chuva_7d: 0, tendencia: null, situacao_ambiental: null };

  it('inclui texto 24h se chuva_24h > 15', () => {
    const j = gerarJustificativas({ ...base, chuva_24h: 20 });
    expect(j.some((s) => s.includes('24h'))).toBe(true);
  });

  it('inclui texto critico se chuva_24h > 30', () => {
    const j = gerarJustificativas({ ...base, chuva_24h: 35 });
    expect(j.some((s) => s.includes('crítico'))).toBe(true);
  });

  it('inclui tendência crescente', () => {
    const j = gerarJustificativas({ ...base, tendencia: 'crescente' });
    expect(j.some((s) => s.includes('crescente'))).toBe(true);
  });

  it('inclui proliferação quando situacao=favoravel_proliferacao', () => {
    const j = gerarJustificativas({ ...base, situacao_ambiental: 'favoravel_proliferacao' });
    expect(j.some((s) => s.includes('proliferação'))).toBe(true);
  });

  it('retorna fallback quando nenhuma condição específica', () => {
    const j = gerarJustificativas(base);
    expect(j.length).toBe(1);
    expect(j[0]).toContain('pluviométricos');
  });
});
