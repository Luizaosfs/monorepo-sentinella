import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  ExecutivoKpis,
  ExecutivoTendencia,
  ExecutivoCobertura,
  ExecutivoBairroVariacao,
  ExecutivoComparativoCiclos,
} from '@/hooks/queries/usePainelExecutivo';

const HEADER_COLOR: [number, number, number] = [15, 23, 42];
const ACCENT_COLOR: [number, number, number] = [37, 99, 235];
const MUTED_COLOR: [number, number, number] = [100, 116, 139];
const ROW_ALT: [number, number, number] = [248, 250, 252];

function addFooter(doc: jsPDF, pageCount: number): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = new Date();
  const dateTimeStr = now.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, pageH - 12, pageW - 14, pageH - 12);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED_COLOR);
    doc.text(
      `Gerado em ${dateTimeStr} | Sentinella — Sistema de Vigilância Epidemiológica`,
      14,
      pageH - 7,
    );
    doc.text(`Página ${i} / ${pageCount}`, pageW - 14, pageH - 7, { align: 'right' });
  }
}

function sectionTitle(doc: jsPDF, title: string, y: number, margin: number): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...HEADER_COLOR);
  doc.text(title, margin, y);
  doc.setDrawColor(...ACCENT_COLOR);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 1.5, margin + doc.getTextWidth(title), y + 1.5);
  return y + 7;
}

export function gerarPainelExecutivoPdf(params: {
  municipio: string;
  semanaRef: string;
  kpis: ExecutivoKpis | null;
  tendencia: ExecutivoTendencia[];
  cobertura: ExecutivoCobertura[];
  bairrosVariacao: ExecutivoBairroVariacao[];
  comparativo: ExecutivoComparativoCiclos | null;
}): void {
  const { municipio, semanaRef, kpis, tendencia, cobertura, bairrosVariacao, comparativo } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // ─── Header ───
  doc.setFillColor(...HEADER_COLOR);
  doc.rect(0, 0, pageW, 30, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('SENTINELLA — Painel Executivo Municipal', margin, 13);

  const semanaFormatada = (() => {
    try {
      return format(new Date(semanaRef), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return semanaRef;
    }
  })();

  doc.setFontSize(9);
  doc.setTextColor(180, 190, 210);
  doc.text(`${municipio}  |  Semana de ${semanaFormatada}`, margin, 23);

  y = 40;

  // ─── Section 1: KPIs ───
  y = sectionTitle(doc, '1. KPIs da Semana', y, margin);

  const kpiRows: [string, string][] = kpis
    ? [
        ['Focos ativos', String(kpis.total_focos_ativos ?? '—')],
        ['Focos novos na semana', String(kpis.focos_novos_semana ?? '—')],
        ['Focos resolvidos na semana', String(kpis.focos_resolvidos_semana ?? '—')],
        ['Taxa de resolução', kpis.taxa_resolucao_pct != null ? `${kpis.taxa_resolucao_pct}%` : '—'],
        ['Conformidade SLA', kpis.sla_conformidade_pct != null ? `${kpis.sla_conformidade_pct}%` : '—'],
        ['Cobertura territorial', kpis.cobertura_pct != null ? `${kpis.cobertura_pct}%` : '—'],
        ['Score médio territorial', kpis.score_medio != null ? String(kpis.score_medio) : '—'],
        ['Imóveis críticos', String(kpis.imoveis_criticos ?? '—')],
        ['Casos notificados novos', String(kpis.casos_novos_semana ?? '—')],
        ['Agentes ativos na semana', String(kpis.agentes_ativos_semana ?? '—')],
      ]
    : [['Dados indisponíveis', '—']];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Indicador', 'Valor']],
    body: kpiRows,
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ─── Section 2: Tendência ───
  if (tendencia.length > 0) {
    if (y > 220) { doc.addPage(); y = margin; }
    y = sectionTitle(doc, '2. Tendência — Últimas 8 Semanas', y, margin);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Semana', 'Focos Novos', 'Resolvidos', 'Vistorias', 'Casos']],
      body: tendencia.map(t => {
        const semana = (() => {
          try { return format(new Date(t.semana_inicio), 'dd/MM/yyyy', { locale: ptBR }); }
          catch { return t.semana_inicio; }
        })();
        return [
          semana,
          String(t.focos_novos ?? 0),
          String(t.focos_resolvidos ?? 0),
          String(t.vistorias ?? 0),
          String(t.casos ?? 0),
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // ─── Section 3: Cobertura por Bairro ───
  if (cobertura.length > 0) {
    if (y > 200) { doc.addPage(); y = margin; }
    y = sectionTitle(doc, '3. Cobertura por Bairro', y, margin);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Bairro', 'Imóveis', 'Visitados 30d', 'Cobertura %', 'Score Médio', 'Focos Ativos']],
      body: cobertura.map(c => [
        c.bairro,
        String(c.total_imoveis ?? 0),
        String(c.imoveis_visitados_30d ?? 0),
        c.cobertura_pct != null ? `${c.cobertura_pct}%` : '—',
        c.score_medio_bairro != null ? String(c.score_medio_bairro) : '—',
        String(c.focos_ativos ?? 0),
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // ─── Section 4: Variação por Bairro ───
  if (bairrosVariacao.length > 0) {
    if (y > 200) { doc.addPage(); y = margin; }
    y = sectionTitle(doc, '4. Variação por Bairro', y, margin);

    const TENDENCIA_LABEL: Record<string, string> = {
      piorando: 'Piorando',
      melhorando: 'Melhorando',
      estavel: 'Estável',
    };

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Bairro', 'Score', 'Tendência', 'Focos 7d', 'Focos 30d', 'Casos 30d']],
      body: bairrosVariacao.map(b => [
        b.bairro,
        b.score_atual != null ? String(b.score_atual) : '—',
        TENDENCIA_LABEL[b.tendencia] ?? b.tendencia,
        String(b.focos_novos_7d ?? 0),
        String(b.focos_novos_30d ?? 0),
        String(b.casos_30d ?? 0),
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'right' },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const row = bairrosVariacao[data.row.index];
          if (row) {
            if (row.tendencia === 'piorando') data.cell.styles.textColor = [220, 38, 38];
            else if (row.tendencia === 'melhorando') data.cell.styles.textColor = [22, 163, 74];
            else data.cell.styles.textColor = MUTED_COLOR;
          }
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // ─── Section 5: Comparativo de Ciclos ───
  if (comparativo) {
    if (y > 210) { doc.addPage(); y = margin; }
    y = sectionTitle(doc, '5. Comparativo de Ciclos', y, margin);

    const fmt = (d: string) => {
      try { return format(new Date(d), 'MMM yyyy', { locale: ptBR }); }
      catch { return d; }
    };

    const cicloAtualLabel = comparativo.ciclo_atual_inicio
      ? fmt(comparativo.ciclo_atual_inicio)
      : 'Ciclo Atual';
    const cicloAnteriorLabel = comparativo.ciclo_anterior_inicio
      ? fmt(comparativo.ciclo_anterior_inicio)
      : 'Ciclo Anterior';

    type MetricaRow = { label: string; atual: number | null; anterior: number | null; menorMelhor: boolean };
    const metricas: MetricaRow[] = [
      { label: 'Focos identificados', atual: comparativo.focos_identificados_atual, anterior: comparativo.focos_identificados_anterior, menorMelhor: true },
      { label: 'Focos resolvidos', atual: comparativo.focos_resolvidos_atual, anterior: comparativo.focos_resolvidos_anterior, menorMelhor: false },
      { label: 'Vistorias realizadas', atual: comparativo.vistorias_atual, anterior: comparativo.vistorias_anterior, menorMelhor: false },
      { label: 'Casos notificados', atual: comparativo.casos_atual, anterior: comparativo.casos_anterior, menorMelhor: true },
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Métrica', cicloAtualLabel, cicloAnteriorLabel, 'Variação %']],
      body: metricas.map(m => {
        const variacao = (m.anterior != null && m.anterior !== 0 && m.atual != null)
          ? (((m.atual - m.anterior) / m.anterior) * 100).toFixed(1) + '%'
          : '—';
        return [
          m.label,
          m.atual != null ? String(m.atual) : '—',
          m.anterior != null ? String(m.anterior) : '—',
          variacao,
        ];
      }),
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const row = metricas[data.row.index];
          const val = data.cell.text[0];
          if (row && val && val !== '—') {
            const num = parseFloat(val);
            const isPositive = num > 0;
            const isBetter = row.menorMelhor ? !isPositive : isPositive;
            data.cell.styles.textColor = isBetter ? [22, 163, 74] : [220, 38, 38];
          }
        }
      },
    });
  }

  // ─── Footer on all pages ───
  addFooter(doc, doc.getNumberOfPages());

  // ─── Save ───
  const dateSlug = format(new Date(), 'yyyy-MM-dd');
  const safeMunicipio = municipio.replace(/\s+/g, '-').toLowerCase();
  doc.save(`painel-executivo-${safeMunicipio}-${dateSlug}.pdf`);
}
