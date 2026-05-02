import { Test } from '@nestjs/testing'
import { GetRegionalComparativo } from '../get-regional-comparativo'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

const makeParams = (daysBack = 30) => {
  const fim = new Date('2026-05-01T00:00:00Z')
  const inicio = new Date(fim.getTime() - daysBack * 86_400_000)
  const duracao = fim.getTime() - inicio.getTime()
  return {
    dataInicio: inicio,
    dataFim: fim,
    anteriorInicio: new Date(inicio.getTime() - duracao),
    anteriorFim: inicio,
  }
}

describe('GetRegionalComparativo', () => {
  let useCase: GetRegionalComparativo
  let mockQueryRaw: jest.Mock

  const mockAtual = {
    total_focos: 40, focos_ativos: 10, focos_resolvidos: 28, focos_descartados: 2,
    taxa_resolucao_pct: 70.0, total_vistorias: 100,
    vulnerabilidade_critica_count: 8, risco_vetorial_critico_count: 5,
    alerta_saude_urgente_count: 3, prioridade_p1_count: 6,
  }
  const mockAnterior = {
    total_focos: 50, focos_ativos: 20, focos_resolvidos: 25, focos_descartados: 5,
    taxa_resolucao_pct: 50.0, total_vistorias: 80,
    vulnerabilidade_critica_count: 10, risco_vetorial_critico_count: 8,
    alerta_saude_urgente_count: 5, prioridade_p1_count: 10,
  }

  beforeEach(async () => {
    mockQueryRaw = jest.fn()
      .mockResolvedValueOnce([mockAtual])    // 1ª chamada = período atual
      .mockResolvedValueOnce([mockAnterior]) // 2ª chamada = período anterior

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetRegionalComparativo,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: mockQueryRaw } },
        },
      ],
    }).compile()

    useCase = moduleRef.get(GetRegionalComparativo)
  })

  it('calcula período anterior com mesma duração', () => {
    const params = makeParams(30)
    const duracao = params.dataFim.getTime() - params.dataInicio.getTime()
    const duracaoAnterior = params.anteriorFim.getTime() - params.anteriorInicio.getTime()
    expect(duracao).toBe(duracaoAnterior)
    expect(params.anteriorFim).toEqual(params.dataInicio)
  })

  it('retorna estrutura com periodo_atual, periodo_anterior e variacao', async () => {
    const result = await useCase.execute(null, makeParams())
    expect(result).toHaveProperty('periodo_atual')
    expect(result).toHaveProperty('periodo_anterior')
    expect(result).toHaveProperty('variacao')
  })

  it('variação percentual correta — focos_totais caíram de 50 para 40', async () => {
    const result = await useCase.execute(null, makeParams())
    // ((40-50)/50)*100 = -20.0
    expect(result.variacao.total_focos_pct).toBe(-20.0)
  })

  it('taxa_resolucao_pp é diferença em pontos percentuais — 70 - 50 = 20', async () => {
    const result = await useCase.execute(null, makeParams())
    expect(result.variacao.taxa_resolucao_pp).toBe(20.0)
  })

  it('anterior = 0 e atual > 0 → variação null (crescimento infinito)', async () => {
    mockQueryRaw.mockReset()
    mockQueryRaw
      .mockResolvedValueOnce([{ ...mockAtual, vulnerabilidade_critica_count: 5 }])
      .mockResolvedValueOnce([{ ...mockAnterior, vulnerabilidade_critica_count: 0 }])

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetRegionalComparativo,
        { provide: PrismaService, useValue: { client: { $queryRaw: mockQueryRaw } } },
      ],
    }).compile()

    const uc = moduleRef.get(GetRegionalComparativo)
    const result = await uc.execute(null, makeParams())
    expect(result.variacao.vulnerabilidade_critica_pct).toBeNull()
  })

  it('anterior = 0 e atual = 0 → variação 0', async () => {
    mockQueryRaw.mockReset()
    mockQueryRaw
      .mockResolvedValueOnce([{ ...mockAtual, alerta_saude_urgente_count: 0 }])
      .mockResolvedValueOnce([{ ...mockAnterior, alerta_saude_urgente_count: 0 }])

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetRegionalComparativo,
        { provide: PrismaService, useValue: { client: { $queryRaw: mockQueryRaw } } },
      ],
    }).compile()

    const uc = moduleRef.get(GetRegionalComparativo)
    const result = await uc.execute(null, makeParams())
    expect(result.variacao.alerta_saude_urgente_pct).toBe(0)
  })

  it('clienteIds = [] retorna zeros sem chamar DB', async () => {
    const result = await useCase.execute([], makeParams())
    expect(mockQueryRaw).not.toHaveBeenCalled()
    expect(result.periodo_atual.total_focos).toBe(0)
    expect(result.periodo_anterior.total_focos).toBe(0)
  })

  it('filtra por clienteIds passados (analista_regional / supervisor)', async () => {
    const ids = ['aaa-0001-0001-0001-000000000001']
    await useCase.execute(ids, makeParams())
    expect(mockQueryRaw).toHaveBeenCalledTimes(2)
    const call = mockQueryRaw.mock.calls[0][0]
    expect(JSON.stringify(call)).toContain('aaa-0001-0001-0001-000000000001')
  })

  it('admin (clienteIds = null) executa sem filtro de clientes', async () => {
    await useCase.execute(null, makeParams())
    expect(mockQueryRaw).toHaveBeenCalledTimes(2)
  })

  it('inclui data_inicio e data_fim como strings ISO no retorno', async () => {
    const result = await useCase.execute(null, makeParams())
    expect(result.periodo_atual.data_inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.periodo_atual.data_fim).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.periodo_anterior.data_inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.periodo_anterior.data_fim).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
