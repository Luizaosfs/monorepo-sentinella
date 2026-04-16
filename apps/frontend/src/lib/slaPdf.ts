import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SlaOperacional, getSlaVisualStatus, getSlaLocalLabel, getTempoRestante } from '@/types/sla';
import { STATUS_SLA_LABEL as STATUS_LABELS } from '@/lib/labels';

interface RankingEntry {
  nome: string;
  total: number;
  concluidos: number;
  violados: number;
  pctCumprido: number;
  tempoMedio: number;
}

interface SlaMetrics {
  total: number;
  semOperador: number;
  violados: number;
  pendentes: number;
}

const STATUS_COLORS: Record<string, [number, number, number]> = {
  pendente: [156, 163, 175],
  em_atendimento: [59, 130, 246],
  concluido: [34, 197, 94],
  vencido: [239, 68, 68],
};

export function exportSlaPdf(
  slas: SlaOperacional[],
  ranking: RankingEntry[],
  metrics: SlaMetrics,
  clienteNome?: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // ─── Header ───
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('SENTINELLA MAP® — Relatório de SLA Operacional', margin, 13);

  doc.setFontSize(9);
  doc.setTextColor(180, 190, 210);
  const subtitle = clienteNome ? `Cliente: ${clienteNome}` : '';
  doc.text(`${subtitle}  |  Gerado em ${dateStr} às ${timeStr}`, margin, 21);

  y = 36;

  // ─── Metrics Summary ───
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Geral', margin, y);
  y += 6;

  const metricBoxes = [
    { label: 'Total SLAs', value: metrics.total.toString() },
    { label: 'Sem Agente', value: metrics.semOperador.toString() },
    { label: 'Pendentes', value: metrics.pendentes.toString() },
    { label: 'Violados', value: metrics.violados.toString() },
    { label: 'Taxa Cumprimento', value: `${metrics.total > 0 ? Math.round(((metrics.total - metrics.violados) / metrics.total) * 100) : 0}%` },
  ];

  const boxW = (pageW - margin * 2 - 8 * (metricBoxes.length - 1)) / metricBoxes.length;
  metricBoxes.forEach((m, i) => {
    const bx = margin + i * (boxW + 8);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(bx, y, boxW, 16, 2, 2, 'F');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(m.value, bx + boxW / 2, y + 8, { align: 'center' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(m.label.toUpperCase(), bx + boxW / 2, y + 13.5, { align: 'center' });
  });

  y += 24;

  // ─── Ranking de Agentes ───
  if (ranking.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Ranking de Agentes', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Agente', 'Total', 'Concluídos', 'Violados', '% Cumprimento', 'Tempo Médio (h)']],
      body: ranking.map((op, idx) => [
        `${idx + 1}º`,
        op.nome,
        op.total.toString(),
        op.concluidos.toString(),
        op.violados.toString(),
        `${op.pctCumprido}%`,
        `${op.tempoMedio}h`,
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
      },
      didParseCell: (data) => {
        // Color % cumprimento
        if (data.section === 'body' && data.column.index === 5) {
          const pct = ranking[data.row.index]?.pctCumprido ?? 0;
          if (pct >= 80) data.cell.styles.textColor = [22, 163, 74];
          else if (pct >= 50) data.cell.styles.textColor = [202, 138, 4];
          else data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
        // Color violados
        if (data.section === 'body' && data.column.index === 4) {
          const v = ranking[data.row.index]?.violados ?? 0;
          if (v > 0) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 30;
    y += 8;
  }

  // ─── SLA Table ───
  // Check if we need a new page
  if (y > pageH - 40) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhamento de SLAs', margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Ind.', 'Bairro', 'Prioridade', 'SLA (h)', 'Prazo', 'Status', 'Violado', 'Agente']],
    body: slas.map(sla => {
      const visual = getSlaVisualStatus(sla);
      const indicator = visual === 'expired' ? '🔴' : visual === 'warning' ? '🟡' : '🟢';
      return [
        indicator,
        getSlaLocalLabel(sla),
        sla.prioridade,
        sla.sla_horas.toString(),
        new Date(sla.prazo_final).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        }),
        STATUS_LABELS[sla.status] || sla.status,
        sla.violado ? 'Sim' : 'Não',
        sla.operador?.nome || '—',
      ];
    }),
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      3: { halign: 'center', cellWidth: 14 },
      6: { halign: 'center', cellWidth: 16 },
    },
    didParseCell: (data) => {
      // Color status
      if (data.section === 'body' && data.column.index === 5) {
        const sla = slas[data.row.index];
        if (sla) {
          const color = STATUS_COLORS[sla.status] || [100, 100, 100];
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = 'bold';
        }
      }
      // Color violado
      if (data.section === 'body' && data.column.index === 6) {
        const sla = slas[data.row.index];
        if (sla?.violado) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // ─── Footer on all pages ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Sentinella MAP® — Relatório SLA — Página ${i}/${totalPages}`,
      pageW / 2,
      pageH - 6,
      { align: 'center' }
    );
  }

  doc.save(`relatorio-sla-${now.toISOString().slice(0, 10)}.pdf`);
}
