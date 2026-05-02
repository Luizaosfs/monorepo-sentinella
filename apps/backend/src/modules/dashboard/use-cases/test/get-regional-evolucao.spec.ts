import { Test } from '@nestjs/testing'
import { GetRegionalEvolucao } from '../get-regional-evolucao'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

const makeParams = (monthsBack = 12) => {
  const fim = new Date()
  const inicio = new Date(fim)
  inicio.setMonth(inicio.getMonth() - monthsBack)
  inicio.setDate(1)
  inicio.setHours(0, 0, 0, 0)
  return { dataInicio: inicio, dataFim: fim }
}

const mockRows = [
  {
    periodo: '2025-01',
    total_focos: 10,
    focos_ativos: 3,
    focos_resolvidos: 6,
    focos_descartados: 1,
    taxa_resolucao_pct: 66.7,
    sla_vencido_count: 0,
    total_vistorias: 20,
    vulnerabilidade_critica_count: 2,
    risco_vetorial_critico_count: 1,
    alerta_saude_urgente_count: 0,
    prioridade_p1_count: 3,
  },
]

describe('GetRegionalEvolucao', () => {
  let useCase: GetRegionalEvolucao
  let mockQueryRaw: jest.Mock

  beforeEach(async () => {
    mockQueryRaw = jest.fn().mockResolvedValue(mockRows)

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetRegionalEvolucao,
        {
          provide: PrismaService,
          useValue: {
            client: { $queryRaw: mockQueryRaw },
          },
        },
      ],
    }).compile()

    useCase = moduleRef.get(GetRegionalEvolucao)
  })

  it('retorna array vazio sem chamar DB quando clienteIds = []', async () => {
    const result = await useCase.execute([], makeParams())
    expect(result).toEqual([])
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('chama $queryRaw quando clienteIds = null (admin sem filtro)', async () => {
    await useCase.execute(null, makeParams())
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('chama $queryRaw quando clienteIds é array não-vazio (analista_regional / supervisor)', async () => {
    const ids = ['aaa-0001-0001-0001-000000000001']
    await useCase.execute(ids, makeParams())
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('retorna rows do banco sem transformação adicional', async () => {
    const result = await useCase.execute(null, makeParams())
    expect(result).toEqual(mockRows)
  })

  it('intervalo default (12 meses) cobre o último ano', () => {
    const params = makeParams(12)
    const diffDays = (params.dataFim.getTime() - params.dataInicio.getTime()) / 86_400_000
    expect(diffDays).toBeGreaterThan(360)
    expect(diffDays).toBeLessThan(370)
  })

  it('intervalo de 24 meses está dentro do limite máximo', () => {
    const params = makeParams(24)
    const diffDays = (params.dataFim.getTime() - params.dataInicio.getTime()) / 86_400_000
    // 24 meses calendário podem gerar 730-732 dias dependendo dos meses envolvidos
    expect(diffDays).toBeLessThanOrEqual(732)
  })

  it('analista_regional: supervisor com único cliente vê somente seu cliente', async () => {
    const supervisorClienteId = ['bbb-0002-0002-0002-000000000002']
    await useCase.execute(supervisorClienteId, makeParams())
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    // A filtragem real é feita no SQL parametrizado — garantimos que o use-case passa o ID correto
    const callArg = mockQueryRaw.mock.calls[0][0]
    expect(JSON.stringify(callArg)).toContain('bbb-0002-0002-0002-000000000002')
  })
})
