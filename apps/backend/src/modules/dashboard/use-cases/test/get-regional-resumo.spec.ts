import { Test } from '@nestjs/testing'
import { GetRegionalResumo } from '../get-regional-resumo'

const mockQueryRaw = jest.fn()
const mockPrismaService = {
  client: { $queryRaw: mockQueryRaw },
}

describe('GetRegionalResumo', () => {
  let useCase: GetRegionalResumo

  beforeEach(async () => {
    mockQueryRaw.mockClear()
    const module = await Test.createTestingModule({
      providers: [
        GetRegionalResumo,
        { provide: 'PrismaService', useValue: mockPrismaService },
      ],
    })
      .overrideProvider(GetRegionalResumo)
      .useValue(new (GetRegionalResumo as any)(mockPrismaService))
      .compile()

    useCase = module.get(GetRegionalResumo)
  })

  it('retorna array vazio imediatamente quando clienteIds é lista vazia', async () => {
    const result = await useCase.execute([])
    expect(result).toEqual([])
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('chama $queryRaw sem filtro de cliente quando clienteIds é null (admin)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ cliente_id: 'abc', municipio_nome: 'Teste' }])
    const result = await useCase.execute(null)
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
  })

  it('chama $queryRaw com lista de clienteIds quando escopo limitado', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ cliente_id: 'id1' }, { cliente_id: 'id2' }])
    const result = await useCase.execute(['id1', 'id2'])
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(2)
  })

  it('chama $queryRaw com um único clienteId para supervisor', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ cliente_id: 'id-supervisor' }])
    const result = await useCase.execute(['id-supervisor'])
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
  })
})
