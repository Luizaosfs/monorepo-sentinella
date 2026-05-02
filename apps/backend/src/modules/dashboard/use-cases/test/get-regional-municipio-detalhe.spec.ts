import { NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'
import { requireClientePermitido } from '@/shared/security/access-scope.helpers'
import { GetRegionalComparativo } from '../get-regional-comparativo'
import { GetRegionalEvolucao } from '../get-regional-evolucao'
import { GetRegionalMunicipioDetalhe } from '../get-regional-municipio-detalhe'
import { GetRegionalResumo } from '../get-regional-resumo'

const ID_A = 'aaaaaaaa-0001-0001-0001-000000000001'
const ID_B = 'bbbbbbbb-0002-0002-0002-000000000002'

const makeResumo = (clienteId = ID_A) => ({
  cliente_id: clienteId,
  municipio_nome: 'Município A',
  cidade: 'Cidade A',
  uf: 'SP',
  total_focos: 10, focos_ativos: 3, focos_resolvidos: 6, focos_descartados: 1,
  taxa_resolucao_pct: 60.0, sla_vencido_count: 2, total_vistorias: 50,
  vulnerabilidade_alta_count: 5, vulnerabilidade_critica_count: 2,
  risco_vetorial_alto_count: 4, risco_vetorial_critico_count: 1,
  alerta_saude_urgente_count: 3, prioridade_p1_count: 2, prioridade_p2_count: 4,
  calculado_em: new Date().toISOString(),
})

const makeVuln = () => ({
  total_vistorias: 50,
  vulnerabilidade_baixa: 20, vulnerabilidade_media: 15, vulnerabilidade_alta: 10, vulnerabilidade_critica: 5,
  risco_vetorial_baixo: 20, risco_vetorial_medio: 15, risco_vetorial_alto: 10, risco_vetorial_critico: 5,
  alerta_saude_normal: 30, alerta_saude_atencao: 15, alerta_saude_urgente: 5,
  prioridade_p1: 5, prioridade_p2: 10, prioridade_p3: 15, prioridade_p4: 10, prioridade_p5: 10,
})

describe('GetRegionalMunicipioDetalhe', () => {
  let useCase: GetRegionalMunicipioDetalhe
  let mockQueryRaw: jest.Mock
  let mockResumoExecute: jest.Mock
  let mockEvolucaoExecute: jest.Mock
  let mockComparativoExecute: jest.Mock

  const mockComparativoResult = {
    periodo_atual: { data_inicio: '2026-04-01', data_fim: '2026-05-01', total_focos: 10 },
    periodo_anterior: { data_inicio: '2026-03-02', data_fim: '2026-04-01', total_focos: 15 },
    variacao: { total_focos_pct: -33.3 },
  }

  beforeEach(async () => {
    mockQueryRaw = jest.fn().mockResolvedValue([makeVuln()])
    mockResumoExecute = jest.fn().mockResolvedValue([makeResumo()])
    mockEvolucaoExecute = jest.fn().mockResolvedValue([])
    mockComparativoExecute = jest.fn().mockResolvedValue(mockComparativoResult)

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetRegionalMunicipioDetalhe,
        { provide: PrismaService, useValue: { client: { $queryRaw: mockQueryRaw } } },
        { provide: GetRegionalResumo, useValue: { execute: mockResumoExecute } },
        { provide: GetRegionalEvolucao, useValue: { execute: mockEvolucaoExecute } },
        { provide: GetRegionalComparativo, useValue: { execute: mockComparativoExecute } },
      ],
    }).compile()

    useCase = moduleRef.get(GetRegionalMunicipioDetalhe)
  })

  it('retorna resumo, vulnerabilidade, evolucao e comparativo', async () => {
    const result = await useCase.execute(ID_A)
    expect(result).toHaveProperty('cliente')
    expect(result).toHaveProperty('resumo')
    expect(result).toHaveProperty('vulnerabilidade')
    expect(result).toHaveProperty('evolucao')
    expect(result).toHaveProperty('comparativo')
  })

  it('popula cliente com id, nome, cidade e uf do resumo', async () => {
    const result = await useCase.execute(ID_A)
    expect(result.cliente.id).toBe(ID_A)
    expect(result.cliente.nome).toBe('Município A')
    expect(result.cliente.cidade).toBe('Cidade A')
    expect(result.cliente.uf).toBe('SP')
  })

  it('não usa municipio_nome como chave de merge — usa cliente_id', async () => {
    const result = await useCase.execute(ID_A)
    expect(result.cliente.id).toBe(ID_A)
    // resumo vem do $queryRaw filtrado pelo clienteId, não por string do município
    expect(mockResumoExecute).toHaveBeenCalledWith([ID_A])
  })

  it('lança NotFoundException se resumo não retornar linha', async () => {
    mockResumoExecute.mockResolvedValueOnce([])
    await expect(useCase.execute(ID_A)).rejects.toThrow(NotFoundException)
  })

  it('passa [clienteId] para GetRegionalResumo, Evolucao e Comparativo', async () => {
    await useCase.execute(ID_A)
    expect(mockResumoExecute).toHaveBeenCalledWith([ID_A])
    expect(mockEvolucaoExecute).toHaveBeenCalledWith([ID_A], expect.any(Object))
    expect(mockComparativoExecute).toHaveBeenCalledWith([ID_A], expect.any(Object))
  })

  it('vulnerabilidade contém todos os campos do spec (incluindo alerta_saude_normal/atencao e p4/p5)', async () => {
    const result = await useCase.execute(ID_A)
    const v = result.vulnerabilidade as Record<string, number>
    expect(v).toHaveProperty('alerta_saude_normal')
    expect(v).toHaveProperty('alerta_saude_atencao')
    expect(v).toHaveProperty('alerta_saude_urgente')
    expect(v).toHaveProperty('prioridade_p4')
    expect(v).toHaveProperty('prioridade_p5')
    expect(v).toHaveProperty('total_vistorias')
  })

  it('comparativo usa período de ~30 dias', async () => {
    await useCase.execute(ID_A)
    const [, params] = mockComparativoExecute.mock.calls[0]
    const duracaoDias = (params.dataFim.getTime() - params.dataInicio.getTime()) / 86400000
    // dataInicio = midnight 30 dias atrás; dataFim = now → entre 30 e 31 dias
    expect(duracaoDias).toBeGreaterThanOrEqual(30)
    expect(duracaoDias).toBeLessThan(31)
    expect(params.anteriorFim).toEqual(params.dataInicio)
  })

  it('evolucao usa intervalo de ~12 meses', async () => {
    await useCase.execute(ID_A)
    const [, params] = mockEvolucaoExecute.mock.calls[0]
    const meses = (params.dataFim.getTime() - params.dataInicio.getTime()) / (30 * 86400000)
    expect(meses).toBeGreaterThanOrEqual(11)
    expect(meses).toBeLessThanOrEqual(13)
  })
})

// ── Validação de escopo (requireClientePermitido) ─────────────────────────────
// A autorização real ocorre no controller via requireClientePermitido.
// Os casos abaixo verificam a invariante que protege o drill-down.

describe('requireClientePermitido — validação do escopo', () => {
  const makeScope = (ids: string[]) => ({
    kind: 'regional' as const,
    userId: 'u1',
    papeis: ['analista_regional'] as any[],
    isAdmin: false as const,
    tenantId: null,
    clienteIdsPermitidos: ids,
    agrupamentoId: 'agr-001',
  })

  it('analista_regional com clienteId no agrupamento — não lança', () => {
    expect(() => requireClientePermitido(makeScope([ID_A, ID_B]), ID_A)).not.toThrow()
  })

  it('analista_regional com clienteId fora do agrupamento — lança ForbiddenException', () => {
    expect(() => requireClientePermitido(makeScope([ID_B]), ID_A)).toThrow()
  })

  it('supervisor com próprio clienteId — não lança', () => {
    const scope = { kind: 'municipal' as const, userId: 'u2', papeis: ['supervisor'] as any[], isAdmin: false as const, tenantId: ID_A, clienteIdsPermitidos: [ID_A] as [string], agrupamentoId: null }
    expect(() => requireClientePermitido(scope, ID_A)).not.toThrow()
  })

  it('supervisor com clienteId de outro município — lança ForbiddenException', () => {
    const scope = { kind: 'municipal' as const, userId: 'u2', papeis: ['supervisor'] as any[], isAdmin: false as const, tenantId: ID_A, clienteIdsPermitidos: [ID_A] as [string], agrupamentoId: null }
    expect(() => requireClientePermitido(scope, ID_B)).toThrow()
  })

  it('admin (clienteIdsPermitidos = null) — não lança para qualquer clienteId', () => {
    const scope = { kind: 'platform' as const, userId: 'u3', papeis: ['admin'] as any[], isAdmin: true as const, tenantId: null, clienteIdsPermitidos: null, agrupamentoId: null }
    expect(() => requireClientePermitido(scope, ID_A)).not.toThrow()
    expect(() => requireClientePermitido(scope, ID_B)).not.toThrow()
  })
})
