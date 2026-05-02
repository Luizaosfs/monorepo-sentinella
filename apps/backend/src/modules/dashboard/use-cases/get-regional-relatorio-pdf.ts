import { Injectable } from '@nestjs/common'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit')
import { GetRegionalResumo } from './get-regional-resumo'
import { GetRegionalVulnerabilidade } from './get-regional-vulnerabilidade'

type AnyRow = Record<string, unknown>

interface MergedRow {
  cliente_id: string
  municipio_nome: string
  uf: string
  total_focos: number
  focos_ativos: number
  focos_resolvidos: number
  taxa_resolucao_pct: number
  sla_vencido_count: number
  total_vistorias: number
  vulnerabilidade_critica: number
  risco_vetorial_critico: number
  alerta_saude_urgente: number
  prioridade_p1: number
}

const C = {
  brand:    '#4F46E5',
  dark:     '#1E1E1E',
  gray:     '#646464',
  lightRow: '#F5F5FA',
  border:   '#DCDCE6',
  white:    '#FFFFFF',
}

@Injectable()
export class GetRegionalRelatorioPDF {
  constructor(
    private readonly resumo: GetRegionalResumo,
    private readonly vulnerabilidade: GetRegionalVulnerabilidade,
  ) {}

  async execute(clienteIds: string[] | null): Promise<Buffer> {
    if (clienteIds !== null && clienteIds.length === 0) {
      return this.buildPdf([])
    }

    const [resumoRows, vulnRows] = await Promise.all([
      this.resumo.execute(clienteIds),
      this.vulnerabilidade.execute(clienteIds),
    ]) as [AnyRow[], AnyRow[]]

    const vulnMap = new Map<string, AnyRow>()
    for (const v of vulnRows) {
      vulnMap.set(v['cliente_id'] as string, v)
    }

    const merged: MergedRow[] = resumoRows.map(r => {
      const v = vulnMap.get(r['cliente_id'] as string)
      return {
        cliente_id:            String(r['cliente_id'] ?? ''),
        municipio_nome:        String(r['municipio_nome'] ?? ''),
        uf:                    String(r['uf'] ?? ''),
        total_focos:           Number(r['total_focos'] ?? 0),
        focos_ativos:          Number(r['focos_ativos'] ?? 0),
        focos_resolvidos:      Number(r['focos_resolvidos'] ?? 0),
        taxa_resolucao_pct:    Number(r['taxa_resolucao_pct'] ?? 0),
        sla_vencido_count:     Number(r['sla_vencido_count'] ?? 0),
        total_vistorias:       Number(r['total_vistorias'] ?? 0),
        vulnerabilidade_critica: Number(v?.['vulnerabilidade_critica'] ?? r['vulnerabilidade_critica_count'] ?? 0),
        risco_vetorial_critico:  Number(v?.['risco_vetorial_critico']  ?? r['risco_vetorial_critico_count']  ?? 0),
        alerta_saude_urgente:    Number(v?.['alerta_saude_urgente']    ?? r['alerta_saude_urgente_count']    ?? 0),
        prioridade_p1:           Number(v?.['prioridade_p1']           ?? r['prioridade_p1_count']           ?? 0),
      }
    })

    return this.buildPdf(merged)
  }

  private buildPdf(rows: MergedRow[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 30,
        autoFirstPage: true,
        info: { Title: 'Relatório Regional Sentinella', Author: 'Sentinella' },
      })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      this.writePage1(doc, rows)
      this.writePage2(doc, rows)
      this.writePage3(doc, rows)

      doc.end()
    })
  }

  // ─── Página 1: capa + KPIs regionais ───────────────────────────────────────

  private writePage1(doc: PDFKit.PDFDocument, rows: MergedRow[]) {
    const totalFocos     = rows.reduce((s, r) => s + r.total_focos, 0)
    const focosAtivos    = rows.reduce((s, r) => s + r.focos_ativos, 0)
    const focosResolvidos = rows.reduce((s, r) => s + r.focos_resolvidos, 0)
    const slaVencido     = rows.reduce((s, r) => s + r.sla_vencido_count, 0)
    const totalVistorias = rows.reduce((s, r) => s + r.total_vistorias, 0)
    const totalElegivel  = focosResolvidos + focosAtivos
    const taxaRegional   = totalElegivel > 0 ? (focosResolvidos / totalElegivel) * 100 : 0

    doc.rect(0, 0, doc.page.width, 65).fill(C.brand)
    doc.fillColor(C.white).fontSize(22).font('Helvetica-Bold')
      .text('Relatório Regional Sentinella', 30, 14)
    doc.fontSize(9).font('Helvetica')
      .text(
        `Gerado em ${new Date().toLocaleString('pt-BR')}  •  ${rows.length} município${rows.length !== 1 ? 's' : ''}`,
        30, 44,
      )

    doc.fillColor(C.dark).fontSize(13).font('Helvetica-Bold')
      .text('Resumo Consolidado', 30, 85)

    const kpis = [
      { label: 'Municípios',      value: String(rows.length) },
      { label: 'Total de Focos',  value: String(totalFocos) },
      { label: 'Focos Ativos',    value: String(focosAtivos) },
      { label: 'Focos Resolvidos', value: String(focosResolvidos) },
      { label: 'Taxa Resolução',  value: `${taxaRegional.toFixed(1)}%` },
      { label: 'SLA Vencido',     value: String(slaVencido) },
      { label: 'Total Vistorias', value: String(totalVistorias) },
    ]

    const boxW = 100, boxH = 60, gap = 10, startX = 30, startY = 108
    for (let i = 0; i < kpis.length; i++) {
      const x = startX + i * (boxW + gap)
      doc.roundedRect(x, startY, boxW, boxH, 5).fillAndStroke(C.lightRow, C.brand)
      doc.fillColor(C.dark).fontSize(22).font('Helvetica-Bold')
        .text(kpis[i].value, x, startY + 10, { width: boxW, align: 'center', lineBreak: false })
      doc.fillColor(C.gray).fontSize(8).font('Helvetica')
        .text(kpis[i].label, x, startY + 38, { width: boxW, align: 'center', lineBreak: false })
    }

    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica-Oblique')
      .text(
        'Relatório de uso exclusivo para análise regional. Não contém ações operacionais.',
        30, doc.page.height - 25, { width: doc.page.width - 60 },
      )
  }

  // ─── Página 2: tabela comparativa por município ─────────────────────────────

  private writePage2(doc: PDFKit.PDFDocument, rows: MergedRow[]) {
    doc.addPage()

    doc.rect(0, 0, doc.page.width, 40).fill(C.brand)
    doc.fillColor(C.white).fontSize(13).font('Helvetica-Bold')
      .text('Tabela Comparativa por Município', 30, 13)

    const headers   = ['Município', 'UF', 'Focos', 'Ativos', 'Resolvidos', 'Taxa Res.%', 'SLA Venc.', 'Vistorias', 'Vuln Crit.', 'Risco Crit.', 'Alert. Urg.', 'P1']
    const colWidths = [112, 25, 42, 42, 50, 50, 50, 55, 55, 55, 55, 40]

    const tableRows = rows.slice(0, 50).map(r => [
      r.municipio_nome,
      r.uf,
      String(r.total_focos),
      String(r.focos_ativos),
      String(r.focos_resolvidos),
      `${r.taxa_resolucao_pct.toFixed(1)}%`,
      String(r.sla_vencido_count),
      String(r.total_vistorias),
      String(r.vulnerabilidade_critica),
      String(r.risco_vetorial_critico),
      String(r.alerta_saude_urgente),
      String(r.prioridade_p1),
    ])

    this.drawTable(doc, headers, tableRows, colWidths, 50, { paginate: true })
  }

  // ─── Página 3: rankings Top 10 ──────────────────────────────────────────────

  private writePage3(doc: PDFKit.PDFDocument, rows: MergedRow[]) {
    doc.addPage()

    doc.rect(0, 0, doc.page.width, 40).fill(C.brand)
    doc.fillColor(C.white).fontSize(13).font('Helvetica-Bold')
      .text('Rankings por Município — Top 10', 30, 13)

    const top10 = (field: keyof MergedRow): string[][] =>
      [...rows]
        .sort((a, b) => (b[field] as number) - (a[field] as number))
        .slice(0, 10)
        .map(r => [r.municipio_nome, String(r[field])])

    const rankings: Array<{ title: string; field: keyof MergedRow }> = [
      { title: 'Vulnerabilidade Crítica',  field: 'vulnerabilidade_critica' },
      { title: 'Risco Vetorial Crítico',   field: 'risco_vetorial_critico' },
      { title: 'Alertas Urgentes',         field: 'alerta_saude_urgente' },
      { title: 'Prioridade P1',            field: 'prioridade_p1' },
    ]

    const colWidths = [200, 65]
    const tableW   = colWidths[0] + colWidths[1]
    const gapX     = 60
    const gapY     = 20
    const headerH  = 18
    const rowH     = 16
    const tableH   = headerH + 10 * rowH // 10 rows

    const positions = [
      { x: 30,              y: 55 },
      { x: 30 + tableW + gapX, y: 55 },
      { x: 30,              y: 55 + tableH + gapY },
      { x: 30 + tableW + gapX, y: 55 + tableH + gapY },
    ]

    for (let i = 0; i < rankings.length; i++) {
      const { title, field } = rankings[i]
      const { x, y } = positions[i]
      doc.fillColor(C.dark).fontSize(9).font('Helvetica-Bold')
        .text(title, x, y - 13, { lineBreak: false })
      this.drawTable(doc, ['Município', 'Total'], top10(field), colWidths, y, {
        startX: x,
        paginate: false,
      })
    }
  }

  // ─── Helper: renderiza tabela com cabeçalho + paginação opcional ─────────────

  private drawTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
    colWidths: number[],
    startY: number,
    opts: { startX?: number; paginate?: boolean } = {},
  ) {
    const startX  = opts.startX ?? 30
    const paginate = opts.paginate ?? true
    const rowH    = 16
    const headerH = 18
    const fs      = 7.5
    const totalW  = colWidths.reduce((a, b) => a + b, 0)
    const pageBot = doc.page.height - 30

    const drawHeader = (x: number, y: number) => {
      doc.rect(x, y, totalW, headerH).fill(C.brand)
      let cx = x
      for (let i = 0; i < headers.length; i++) {
        doc.fillColor(C.white).fontSize(fs).font('Helvetica-Bold')
          .text(headers[i], cx + 3, y + 4, { width: colWidths[i] - 6, lineBreak: false, ellipsis: true })
        cx += colWidths[i]
      }
    }

    drawHeader(startX, startY)
    let y = startY + headerH

    for (let ri = 0; ri < rows.length; ri++) {
      if (paginate && y + rowH > pageBot) {
        doc.addPage()
        y = 30
        drawHeader(startX, y)
        y += headerH
      }

      if (ri % 2 === 1) {
        doc.rect(startX, y, totalW, rowH).fill(C.lightRow)
      }

      let cx = startX
      for (let ci = 0; ci < rows[ri].length; ci++) {
        doc.fillColor(C.dark).fontSize(fs).font('Helvetica')
          .text(rows[ri][ci], cx + 3, y + 4, { width: colWidths[ci] - 6, lineBreak: false, ellipsis: true })
        cx += colWidths[ci]
      }

      doc.moveTo(startX, y + rowH).lineTo(startX + totalW, y + rowH).stroke(C.border)
      y += rowH
    }
  }
}
