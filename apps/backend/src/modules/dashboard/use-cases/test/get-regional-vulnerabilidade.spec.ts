import { Test } from '@nestjs/testing'
import { GetRegionalVulnerabilidade } from '../get-regional-vulnerabilidade'

const mockQueryRaw = jest.fn()
const mockPrismaService = {
  client: { $queryRaw: mockQueryRaw },
}

describe('GetRegionalVulnerabilidade', () => {
  let useCase: GetRegionalVulnerabilidade

  beforeEach(async () => {
    mockQueryRaw.mockClear()
    const module = await Test.createTestingModule({
      providers: [
        GetRegionalVulnerabilidade,
        { provide: 'PrismaService', useValue: mockPrismaService },
      ],
    })
      .overrideProvider(GetRegionalVulnerabilidade)
      .useValue(new (GetRegionalVulnerabilidade as any)(mockPrismaService))
      .compile()

    useCase = module.get(GetRegionalVulnerabilidade)
  })

  it('retorna array vazio sem chamar banco quando clienteIds é lista vazia (analista sem clientes)', async () => {
    const result = await useCase.execute([])
    expect(result).toEqual([])
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('chama $queryRaw sem filtro quando clienteIds é null (admin — acesso completo)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ cliente_id: 'abc', municipio_nome: 'Cidade A', total_vistorias: 10 }])
    const result = await useCase.execute(null)
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
  })

  it('chama $queryRaw com lista de clienteIds (analista_regional — somente clientes do agrupamento)', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { cliente_id: 'id1', municipio_nome: 'Cidade 1', total_vistorias: 5 },
      { cliente_id: 'id2', municipio_nome: 'Cidade 2', total_vistorias: 3 },
    ])
    const result = await useCase.execute(['id1', 'id2'])
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(2)
  })

  it('chama $queryRaw com único clienteId (supervisor — somente seu município)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ cliente_id: 'id-supervisor', municipio_nome: 'Cidade S', total_vistorias: 7 }])
    const result = await useCase.execute(['id-supervisor'])
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
  })
})
