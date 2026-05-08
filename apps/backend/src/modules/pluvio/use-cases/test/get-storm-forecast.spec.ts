import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { OpenMeteoService } from '../../services/open-meteo.service';
import { GetStormForecast } from '../get-storm-forecast';

const REGIAO_COM_COORDS = { id: 'r1', nome: 'Norte', latitude: -15.0, longitude: -47.0 };
const REGIAO_SEM_COORDS = { id: 'r2', nome: 'Sem Coords', latitude: null, longitude: null };

const DADOS_MODERADO = { precipitacaoDias: [15, 0, 0, 0], ventoDias: [0, 0, 0, 0] };
const DADOS_ALTO = { precipitacaoDias: [0, 25, 0, 0], ventoDias: [0, 0, 0, 0] };
const DADOS_CRITICO = { precipitacaoDias: [55, 0, 0, 0], ventoDias: [0, 0, 0, 0] };
const DADOS_VENTO_ALTO = { precipitacaoDias: [0, 0, 0, 0], ventoDias: [70, 0, 0, 0] };
const DADOS_VENTO_CRITICO = { precipitacaoDias: [0, 0, 0, 0], ventoDias: [95, 0, 0, 0] };

describe('GetStormForecast', () => {
  let useCase: GetStormForecast;
  const mockFetch = jest.fn();
  const mockFindMany = jest.fn();

  const prismaMock = {
    client: { regioes: { findMany: mockFindMany } },
  } as any;

  const openMeteoMock = { fetchStormForecast: mockFetch } as any;

  async function build() {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetStormForecast,
        { provide: PrismaService, useValue: prismaMock },
        { provide: OpenMeteoService, useValue: openMeteoMock },
      ],
    }).compile();
    return module.get<GetStormForecast>(GetStormForecast);
  }

  beforeEach(async () => {
    useCase = await build();
    mockFindMany.mockResolvedValue([REGIAO_COM_COORDS]);
  });

  // ── classificação de severidade ──────────────────────────────────────────

  it('classifica chuva moderada (10-19mm)', async () => {
    mockFetch.mockResolvedValue(DADOS_MODERADO);
    const [alert] = await useCase.execute('c1');
    expect(alert.severity).toBe('moderado');
    expect(alert.type).toBe('Chuva moderada');
    expect(alert.day).toBe('Hoje');
  });

  it('classifica chuva intensa (20-49mm)', async () => {
    mockFetch.mockResolvedValue(DADOS_ALTO);
    const [alert] = await useCase.execute('c1');
    expect(alert.severity).toBe('alto');
    expect(alert.type).toBe('Chuva intensa');
    expect(alert.day).toBe('Amanhã');
  });

  it('classifica tempestade forte (>=50mm)', async () => {
    mockFetch.mockResolvedValue(DADOS_CRITICO);
    const [alert] = await useCase.execute('c1');
    expect(alert.severity).toBe('critico');
    expect(alert.type).toBe('Tempestade forte');
  });

  it('classifica vendaval alto (60-89 km/h)', async () => {
    mockFetch.mockResolvedValue(DADOS_VENTO_ALTO);
    const [alert] = await useCase.execute('c1');
    expect(alert.type).toBe('Vendaval');
    expect(alert.severity).toBe('alto');
    expect(alert.day).toBe('Hoje');
  });

  it('classifica vendaval critico (>=90 km/h)', async () => {
    mockFetch.mockResolvedValue(DADOS_VENTO_CRITICO);
    const [alert] = await useCase.execute('c1');
    expect(alert.severity).toBe('critico');
  });

  it('ignora precipitação abaixo de 10mm', async () => {
    mockFetch.mockResolvedValue({ precipitacaoDias: [8, 9, 0, 0], ventoDias: [0, 0, 0, 0] });
    const result = await useCase.execute('c1');
    expect(result).toEqual([]);
  });

  // ── regiões sem coordenadas ──────────────────────────────────────────────

  it('ignora regiões sem lat/lng', async () => {
    mockFindMany.mockResolvedValue([REGIAO_COM_COORDS, REGIAO_SEM_COORDS]);
    mockFetch.mockResolvedValue(DADOS_MODERADO);
    await useCase.execute('c1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(REGIAO_COM_COORDS.latitude, REGIAO_COM_COORDS.longitude);
  });

  // ── resiliência / falha parcial ───────────────────────────────────────────

  it('retorna [] quando Open Meteo retorna null', async () => {
    mockFetch.mockResolvedValue(null);
    const result = await useCase.execute('c1');
    expect(result).toEqual([]);
  });

  it('retorna resultado parcial quando uma região lança exceção', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'r1', nome: 'Norte', latitude: -15, longitude: -47 },
      { id: 'r2', nome: 'Sul', latitude: -16, longitude: -48 },
    ]);
    mockFetch
      .mockResolvedValueOnce(DADOS_ALTO)
      .mockRejectedValueOnce(new Error('timeout'));

    const result = await useCase.execute('c1');
    expect(result.length).toBe(1);
    expect(result[0].regiao).toBe('Norte');
  });

  // ── ordenação ────────────────────────────────────────────────────────────

  it('ordena alertas critico > alto > moderado', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'r1', nome: 'A', latitude: -15, longitude: -47 },
      { id: 'r2', nome: 'B', latitude: -16, longitude: -48 },
      { id: 'r3', nome: 'C', latitude: -17, longitude: -49 },
    ]);
    mockFetch
      .mockResolvedValueOnce(DADOS_MODERADO)
      .mockResolvedValueOnce(DADOS_CRITICO)
      .mockResolvedValueOnce(DADOS_ALTO);

    const result = await useCase.execute('c1');
    expect(result[0].severity).toBe('critico');
    expect(result[result.length - 1].severity).toBe('moderado');
  });

  // ── cache ────────────────────────────────────────────────────────────────

  it('cache hit: segunda chamada não aciona Open Meteo', async () => {
    mockFetch.mockResolvedValue(DADOS_MODERADO);
    await useCase.execute('cliente-cache');
    await useCase.execute('cliente-cache');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('cache: clienteIds diferentes têm caches independentes', async () => {
    mockFetch.mockResolvedValue(DADOS_MODERADO);
    await useCase.execute('cliente-X');
    await useCase.execute('cliente-Y');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // ── tenant isolation ─────────────────────────────────────────────────────

  it('filtra regiões por clienteId', async () => {
    mockFetch.mockResolvedValue(null);
    await useCase.execute('tenant-abc');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cliente_id: 'tenant-abc' }),
      }),
    );
  });
});
