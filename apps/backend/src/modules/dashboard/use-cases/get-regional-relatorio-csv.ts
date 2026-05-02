import { Injectable } from '@nestjs/common'
import { GetRegionalResumo } from './get-regional-resumo'
import { GetRegionalVulnerabilidade } from './get-regional-vulnerabilidade'

type AnyRow = Record<string, unknown>

@Injectable()
export class GetRegionalRelatorioCSV {
  constructor(
    private readonly resumo: GetRegionalResumo,
    private readonly vulnerabilidade: GetRegionalVulnerabilidade,
  ) {}

  async execute(clienteIds: string[] | null): Promise<string> {
    if (clienteIds !== null && clienteIds.length === 0) {
      return this.buildCsv([], new Map())
    }

    const [resumoRows, vulnRows] = await Promise.all([
      this.resumo.execute(clienteIds),
      this.vulnerabilidade.execute(clienteIds),
    ]) as [AnyRow[], AnyRow[]]

    const vulnMap = new Map<string, AnyRow>()
    for (const v of vulnRows) {
      vulnMap.set(v['cliente_id'] as string, v)
    }

    return this.buildCsv(resumoRows, vulnMap)
  }

  private buildCsv(rows: AnyRow[], vulnMap: Map<string, AnyRow>): string {
    const headers = [
      'Município', 'UF',
      'Focos Totais', 'Focos Ativos', 'Focos Resolvidos', 'Focos Descartados',
      'Taxa Resolução (%)', 'SLA Vencido',
      'Total Vistorias', 'Vistorias Realizadas',
      'Vuln Baixa', 'Vuln Média', 'Vuln Alta', 'Vuln Crítica',
      'Risco Vet Baixo', 'Risco Vet Médio', 'Risco Vet Alto', 'Risco Vet Crítico',
      'Alerta Saúde Urgente', 'Prioridade P1', 'Prioridade P2', 'Prioridade P3',
    ]

    const dataRows = rows.map(r => {
      const v = vulnMap.get(r['cliente_id'] as string)
      return [
        r['municipio_nome'] ?? '',
        r['uf'] ?? '',
        r['total_focos'] ?? 0,
        r['focos_ativos'] ?? 0,
        r['focos_resolvidos'] ?? 0,
        r['focos_descartados'] ?? 0,
        Number(r['taxa_resolucao_pct'] ?? 0).toFixed(1),
        r['sla_vencido_count'] ?? 0,
        r['total_vistorias'] ?? 0,
        r['vistorias_visitadas'] ?? 0,
        v?.['vulnerabilidade_baixa'] ?? 0,
        v?.['vulnerabilidade_media'] ?? 0,
        v?.['vulnerabilidade_alta'] ?? 0,
        v?.['vulnerabilidade_critica'] ?? 0,
        v?.['risco_vetorial_baixo'] ?? 0,
        v?.['risco_vetorial_medio'] ?? 0,
        v?.['risco_vetorial_alto'] ?? 0,
        v?.['risco_vetorial_critico'] ?? 0,
        v?.['alerta_saude_urgente'] ?? r['alerta_saude_urgente_count'] ?? 0,
        v?.['prioridade_p1'] ?? r['prioridade_p1_count'] ?? 0,
        v?.['prioridade_p2'] ?? r['prioridade_p2_count'] ?? 0,
        v?.['prioridade_p3'] ?? 0,
      ]
    })

    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    return '﻿' + [headers, ...dataRows].map(row => row.map(escape).join(',')).join('\r\n')
  }
}
