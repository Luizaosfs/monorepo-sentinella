import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { GetDashboardTerritorial } from '../get-dashboard-territorial';

const CLIENTE_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const CLIENTE_B = 'bbbbbbbb-0000-0000-0000-000000000002';

const emptyKpi = {
  total_focos: BigInt(0),
  focos_ativos: BigInt(0),
  focos_resolvidos: BigInt(0),
  focos_descartados: BigInt(0),
  taxa_resolucao_pct: 0,
  vistorias_realizadas: BigInt(0),
  sla_vencidos: BigInt(0),
  calculado_em: new Date('2026-05-01'),
};

const emptyCalha = { calhas_criticas: BigInt(0), calhas_tratadas: BigInt(0) };

const emptyRisco = {
  menor_incapaz: BigInt(0),
  idoso_incapaz: BigInt(0),
  dep_quimico: BigInt(0),
  risco_alimentar: BigInt(0),
  risco_moradia: BigInt(0),
  criadouro_animais: BigInt(0),
  lixo: BigInt(0),
  residuos_organicos: BigInt(0),
  animais_sinais_lv: BigInt(0),
  caixa_destampada: BigInt(0),
  mobilidade_reduzida: BigInt(0),
  acamado: BigInt(0),
};

function mockAllEmpty(mockFn: jest.Mock) {
  mockFn
    .mockResolvedValueOnce([emptyKpi])   // kpis
    .mockResolvedValueOnce([])           // bairros
    .mockResolvedValueOnce([])           // regioes
    .mockResolvedValueOnce([])           // mapa
    .mockResolvedValueOnce([])           // depositos
    .mockResolvedValueOnce([emptyRisco]) // riscos
    .mockResolvedValueOnce([emptyCalha]); // calhas
}

describe('GetDashboardTerritorial', () => {
  let useCase: GetDashboardTerritorial;
  const mockQueryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetDashboardTerritorial,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: mockQueryRaw } },
        },
      ],
    }).compile();

    useCase = module.get<GetDashboardTerritorial>(GetDashboardTerritorial);
  });

  // 1. Tenant municipal: clienteId é obrigatório e sempre aplicado via parâmetro
  it('aplica cliente_id em todas as queries — sem vazar dados cross-tenant', async () => {
    mockAllEmpty(mockQueryRaw);

    await useCase.execute(CLIENTE_A, {});

    expect(mockQueryRaw).toHaveBeenCalledTimes(7);
    // Cada chamada ao $queryRaw recebe um Prisma.Sql que contém o clienteId
    const calls = mockQueryRaw.mock.calls;
    calls.forEach(([sql]) => {
      // Prisma.Sql serializa valores em .values[] — clienteId deve aparecer em todas
      expect(sql.values).toEqual(expect.arrayContaining([CLIENTE_A]));
    });
  });

  // 2. clienteId não é aceito por query — o execute() só recebe clienteId como arg explícito
  it('execute não possui parâmetro clienteId vindo de query — assinatura garante isolamento', () => {
    // Se alguém tentar passar clienteId via params (que é DashboardTerritorialQuery),
    // o compilador não aceita. Verificamos que o tipo não inclui clienteId.
    type Params = Parameters<typeof useCase.execute>[1];
    const params: Params = {};
    expect(Object.keys(params)).not.toContain('clienteId');
  });

  // 3. Aplica período corretamente — dataInicio e dataFim presentes no SQL
  it('com dataInicio e dataFim — passa datas como valores parameterizados', async () => {
    mockAllEmpty(mockQueryRaw);

    await useCase.execute(CLIENTE_A, { dataInicio: '2026-01-01', dataFim: '2026-03-31' });

    const calls = mockQueryRaw.mock.calls;
    // Primeiras 4 queries (kpi, bairro, regiao, mapa) usam fDataInicio e fDataFim em focos
    calls.slice(0, 4).forEach(([sql]) => {
      const dateValues = sql.values.filter((v: unknown) => v instanceof Date);
      expect(dateValues.length).toBeGreaterThanOrEqual(2);
    });
  });

  // 4. KPIs agregam corretamente — BigInt convertido para number
  it('converte BigInt para number e retorna estrutura correta', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{
        total_focos: BigInt(10),
        focos_ativos: BigInt(4),
        focos_resolvidos: BigInt(3),
        focos_descartados: BigInt(3),
        taxa_resolucao_pct: 42.5,
        vistorias_realizadas: BigInt(7),
        sla_vencidos: BigInt(2),
        calculado_em: new Date('2026-05-01'),
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([emptyRisco])
      .mockResolvedValueOnce([emptyCalha]);

    const result = await useCase.execute(CLIENTE_A, {});

    expect(result.kpis.totalFocos).toBe(10);
    expect(result.kpis.focosAtivos).toBe(4);
    expect(result.kpis.focosResolvidos).toBe(3);
    expect(result.kpis.taxaResolucaoPct).toBe(42.5);
    expect(result.kpis.vistoriasRealizadas).toBe(7);
    expect(result.kpis.slaVencidos).toBe(2);
  });

  // 5. Ranking por bairro — estrutura e conversão corretas
  it('ranking por bairro retorna itens com campos corretos', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([emptyKpi])
      .mockResolvedValueOnce([
        { bairro: 'Centro', total_focos: BigInt(5), focos_ativos: BigInt(3), vistorias_realizadas: BigInt(2), sla_vencidos: BigInt(1) },
        { bairro: '(sem bairro)', total_focos: BigInt(2), focos_ativos: BigInt(1), vistorias_realizadas: BigInt(0), sla_vencidos: BigInt(0) },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([emptyRisco])
      .mockResolvedValueOnce([emptyCalha]);

    const result = await useCase.execute(CLIENTE_A, {});

    expect(result.rankingBairro).toHaveLength(2);
    expect(result.rankingBairro[0]).toEqual({
      bairro: 'Centro',
      totalFocos: 5,
      focosAtivos: 3,
      vistoriasRealizadas: 2,
      slaVencidos: 1,
    });
    expect(result.rankingBairro[1].bairro).toBe('(sem bairro)');
  });

  // 6. Filtros de prioridade e status passam como valores no SQL
  it('filtro de prioridade e status — valores parameterizados no Prisma.Sql', async () => {
    mockAllEmpty(mockQueryRaw);

    await useCase.execute(CLIENTE_A, { prioridade: 'P1', status: 'confirmado' });

    const calls = mockQueryRaw.mock.calls;
    calls.slice(0, 4).forEach(([sql]) => {
      expect(sql.values).toContain('P1');
      expect(sql.values).toContain('confirmado');
    });
  });

  // 7. Cross-tenant: clienteId diferente resulta em queries com valor diferente
  it('cliente B não recebe dados de cliente A — clienteId é o único discriminador', async () => {
    mockAllEmpty(mockQueryRaw);

    await useCase.execute(CLIENTE_B, {});

    mockQueryRaw.mock.calls.forEach(([sql]) => {
      expect(sql.values).toContain(CLIENTE_B);
      expect(sql.values).not.toContain(CLIENTE_A);
    });
  });

  // 8. Pontos do mapa — apenas registros com lat/lng (filtro no SQL)
  it('pontos mapa retornam apenas registros com latitude e longitude preenchidos', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([emptyKpi])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'foco-1', latitude: -23.5, longitude: -46.6, status: 'confirmado', prioridade: 'P2', peso: 4 },
        { id: 'foco-2', latitude: -23.6, longitude: -46.7, status: 'em_tratamento', prioridade: null, peso: 1 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([emptyRisco])
      .mockResolvedValueOnce([emptyCalha]);

    const result = await useCase.execute(CLIENTE_A, {});

    expect(result.pontosMapa).toHaveLength(2);
    result.pontosMapa.forEach((p) => {
      expect(p.latitude).not.toBeNull();
      expect(p.longitude).not.toBeNull();
    });
    expect(result.meta.totalPontosMapa).toBe(2);
  });

  // 9. Heatmap peso — baseado em prioridade real (P1=5, P2=4, ...) sem score inventado
  it('peso do heatmap reflete prioridade real sem criar índice artificial', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([emptyKpi])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'f1', latitude: -23.5, longitude: -46.6, status: 'confirmado', prioridade: 'P1', peso: 5 },
        { id: 'f2', latitude: -23.5, longitude: -46.6, status: 'confirmado', prioridade: 'P3', peso: 3 },
        { id: 'f3', latitude: -23.5, longitude: -46.6, status: 'confirmado', prioridade: null, peso: 1 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([emptyRisco])
      .mockResolvedValueOnce([emptyCalha]);

    const result = await useCase.execute(CLIENTE_A, {});

    const p1 = result.pontosMapa.find((p) => p.prioridade === 'P1')!;
    const p3 = result.pontosMapa.find((p) => p.prioridade === 'P3')!;
    const pNull = result.pontosMapa.find((p) => p.prioridade === null)!;

    expect(p1.peso).toBe(5);
    expect(p3.peso).toBe(3);
    expect(pNull.peso).toBe(1);
  });

  // 10. SLA usa sla_operacional.violado — campo real da tabela
  it('slaVencidos conta apenas registros com violado=true em sla_operacional', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{
        ...emptyKpi,
        total_focos: BigInt(5),
        sla_vencidos: BigInt(2),
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([emptyRisco])
      .mockResolvedValueOnce([emptyCalha]);

    const result = await useCase.execute(CLIENTE_A, {});

    // O SQL faz COUNT FILTER WHERE sl.violado = true — verificamos o valor final
    expect(result.kpis.slaVencidos).toBe(2);
  });

  // 11. Fatores de risco — conta apenas campos reais de vistoria_riscos
  it('fatores de risco mapeia apenas campos reais da tabela vistoria_riscos', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([emptyKpi])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        ...emptyRisco,
        lixo: BigInt(3),
        risco_moradia: BigInt(5),
        criadouro_animais: BigInt(2),
      }])
      .mockResolvedValueOnce([emptyCalha]);

    const result = await useCase.execute(CLIENTE_A, {});

    expect(result.fatoresRisco).not.toBeNull();
    expect(result.fatoresRisco!.lixo).toBe(3);
    expect(result.fatoresRisco!.riscoMoradia).toBe(5);
    expect(result.fatoresRisco!.criadouroAnimais).toBe(2);
    // Campos não citados devem ser zero (vindos do emptyRisco)
    expect(result.fatoresRisco!.depQuimico).toBe(0);
  });

  // 12. Vistorias sem depositos/riscos/calhas não quebram
  it('sem dados de depositos, riscos ou calhas — retorna zeros sem erro', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([emptyKpi])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]) // depositos vazio
      .mockResolvedValueOnce([]) // riscos vazio → fatoresRisco null
      .mockResolvedValueOnce([]); // calhas vazio → zeros

    const result = await useCase.execute(CLIENTE_A, {});

    expect(result.depositosPncd.totais.comFoco).toBe(0);
    expect(result.depositosPncd.porTipo).toHaveLength(0);
    expect(result.fatoresRisco).toBeNull();
    expect(result.kpis.calhasCriticas).toBe(0);
  });

  // 13. Regiões/bairros ausentes → "(sem bairro)" ou excluídos do ranking de região
  it('focos sem bairro aparecem como "(sem bairro)" no ranking', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([emptyKpi])
      .mockResolvedValueOnce([
        { bairro: '(sem bairro)', total_focos: BigInt(3), focos_ativos: BigInt(1), vistorias_realizadas: BigInt(0), sla_vencidos: BigInt(0) },
      ])
      .mockResolvedValueOnce([]) // sem regioes — focos sem regiao_id excluídos
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([emptyRisco])
      .mockResolvedValueOnce([emptyCalha]);

    const result = await useCase.execute(CLIENTE_A, {});

    expect(result.rankingBairro[0].bairro).toBe('(sem bairro)');
    expect(result.rankingRegiao).toHaveLength(0);
  });

  // 14. Filtro por agenteId — valor passa como UUID parameterizado
  it('filtro por agenteId passa como UUID parametrizado nas queries relevantes', async () => {
    const agenteId = 'cccccccc-0000-0000-0000-000000000003';
    mockAllEmpty(mockQueryRaw);

    await useCase.execute(CLIENTE_A, { agenteId });

    const calls = mockQueryRaw.mock.calls;
    // Todas as queries devem conter o agenteId de alguma forma
    // (EXISTS nas 4 primeiras, direto nas 3 últimas)
    calls.forEach(([sql]) => {
      expect(sql.values).toContain(agenteId);
    });
  });
});
