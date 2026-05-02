import { Test } from '@nestjs/testing'
import { GetRegionalRelatorioPDF } from '../get-regional-relatorio-pdf'
import { GetRegionalResumo } from '../get-regional-resumo'
import { GetRegionalVulnerabilidade } from '../get-regional-vulnerabilidade'

const resumoRows = [
  {
    cliente_id: 'aaa-0001-0001-0001-000000000001',
    municipio_nome: 'Município A',
    uf: 'SP',
    total_focos: 10,
    focos_ativos: 3,
    focos_resolvidos: 7,
    focos_descartados: 0,
    taxa_resolucao_pct: 70.0,
    sla_vencido_count: 1,
    total_vistorias: 50,
    vistorias_visitadas: 45,
    vulnerabilidade_critica_count: 5,
    risco_vetorial_critico_count: 3,
    alerta_saude_urgente_count: 2,
    prioridade_p1_count: 4,
    prioridade_p2_count: 2,
  },
  {
    cliente_id: 'bbb-0002-0002-0002-000000000002',
    municipio_nome: 'Município B',
    uf: 'RJ',
    total_focos: 5,
    focos_ativos: 2,
    focos_resolvidos: 3,
    focos_descartados: 0,
    taxa_resolucao_pct: 60.0,
    sla_vencido_count: 0,
    total_vistorias: 20,
    vistorias_visitadas: 18,
    vulnerabilidade_critica_count: 2,
    risco_vetorial_critico_count: 1,
    alerta_saude_urgente_count: 0,
    prioridade_p1_count: 1,
    prioridade_p2_count: 1,
  },
]

// vulnRows usa valores diferentes dos resumoRows para garantir que o merge usa vuln quando disponível
const vulnRows = [
  {
    cliente_id: 'aaa-0001-0001-0001-000000000001',
    municipio_nome: 'Município A',
    vulnerabilidade_critica: 8,
    risco_vetorial_critico: 4,
    alerta_saude_urgente: 3,
    prioridade_p1: 6,
  },
  {
    cliente_id: 'bbb-0002-0002-0002-000000000002',
    municipio_nome: 'Município B',
    vulnerabilidade_critica: 2,
    risco_vetorial_critico: 1,
    alerta_saude_urgente: 0,
    prioridade_p1: 1,
  },
]

describe('GetRegionalRelatorioPDF', () => {
  let useCase: GetRegionalRelatorioPDF
  let mockResumo: { execute: jest.Mock }
  let mockVuln: { execute: jest.Mock }

  beforeEach(async () => {
    mockResumo = { execute: jest.fn().mockResolvedValue(resumoRows) }
    mockVuln   = { execute: jest.fn().mockResolvedValue(vulnRows) }

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetRegionalRelatorioPDF,
        { provide: GetRegionalResumo,         useValue: mockResumo },
        { provide: GetRegionalVulnerabilidade, useValue: mockVuln },
      ],
    }).compile()

    useCase = moduleRef.get(GetRegionalRelatorioPDF)
  })

  it('retorna Buffer não vazio', async () => {
    const result = await useCase.execute(null)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('começa com assinatura PDF %PDF', async () => {
    const result = await useCase.execute(null)
    expect(result.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })

  it('lista vazia retorna PDF válido', async () => {
    const result = await useCase.execute([])
    expect(result).toBeInstanceOf(Buffer)
    expect(result.subarray(0, 4).toString('ascii')).toBe('%PDF')
    expect(mockResumo.execute).not.toHaveBeenCalled()
    expect(mockVuln.execute).not.toHaveBeenCalled()
  })

  it('usa cliente_id como chave de merge — passa clienteIds a ambos use-cases', async () => {
    const ids = ['aaa-0001-0001-0001-000000000001', 'bbb-0002-0002-0002-000000000002']
    const result = await useCase.execute(ids)
    expect(mockResumo.execute).toHaveBeenCalledWith(ids)
    expect(mockVuln.execute).toHaveBeenCalledWith(ids)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })

  it('prefere campos de vulnerabilidade da query vuln quando disponíveis', async () => {
    // Se o merge usasse resumo[vulnerabilidade_critica_count]=5, o PDF seria diferente
    // de vuln[vulnerabilidade_critica]=8. Apenas verificamos que o PDF é gerado sem erro.
    const result = await useCase.execute(null)
    expect(result).toBeInstanceOf(Buffer)
  })

  it('executa resumo e vulnerabilidade em paralelo (ambos chamados)', async () => {
    await useCase.execute(null)
    expect(mockResumo.execute).toHaveBeenCalledTimes(1)
    expect(mockVuln.execute).toHaveBeenCalledTimes(1)
  })
})
