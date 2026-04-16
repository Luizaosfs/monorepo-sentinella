import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AuditEntry {
  id: string;
  changed_at: string;
  action: string;
  config_before: Record<string, unknown> | null;
  config_after: Record<string, unknown> | null;
  usuario?: { nome: string; email: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
};

/**
 * Compara dois objetos JSON e retorna uma lista legível de mudanças.
 */
function diffConfig(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  if (!before && !after) return ['—'];
  if (!before) return ['Configuração inicial criada'];
  if (!after) return ['Configuração removida'];

  const changes: string[] = [];

  // Prioridades
  const prBefore = (before.prioridades || {}) as Record<string, { horas: number; criticidade: string }>;
  const prAfter = (after.prioridades || {}) as Record<string, { horas: number; criticidade: string }>;

  const allKeys = new Set([...Object.keys(prBefore), ...Object.keys(prAfter)]);
  allKeys.forEach(key => {
    const b = prBefore[key];
    const a = prAfter[key];
    if (!b && a) {
      changes.push(`+ Prioridade "${key}" adicionada (${a.horas}h, ${a.criticidade})`);
    } else if (b && !a) {
      changes.push(`- Prioridade "${key}" removida`);
    } else if (b && a) {
      if (b.horas !== a.horas) changes.push(`Prioridade "${key}": horas ${b.horas}→${a.horas}`);
      if (b.criticidade !== a.criticidade) changes.push(`Prioridade "${key}": criticidade ${b.criticidade}→${a.criticidade}`);
    }
  });

  // Fatores
  const fBefore = (before.fatores || {}) as Record<string, number>;
  const fAfter = (after.fatores || {}) as Record<string, number>;
  const fatorLabels: Record<string, string> = {
    risco_muito_alto_pct: 'Risco Muito Alto %',
    persistencia_dias_min: 'Persistência dias mín',
    persistencia_pct: 'Persistência %',
    temperatura_min: 'Temperatura mín °C',
    temperatura_pct: 'Temperatura %',
  };

  Object.keys(fatorLabels).forEach(key => {
    if (fBefore[key] !== fAfter[key]) {
      changes.push(`${fatorLabels[key]}: ${fBefore[key] ?? '—'}→${fAfter[key] ?? '—'}`);
    }
  });

  // Horário comercial
  const hBefore = (before.horario_comercial || {}) as Record<string, unknown>;
  const hAfter = (after.horario_comercial || {}) as Record<string, unknown>;
  if (JSON.stringify(hBefore) !== JSON.stringify(hAfter)) {
    if (hBefore.ativo !== hAfter.ativo) {
      changes.push(`Horário comercial: ${hAfter.ativo ? 'Ativado' : 'Desativado'}`);
    }
    if (hBefore.inicio !== hAfter.inicio) changes.push(`Início expediente: ${hBefore.inicio}→${hAfter.inicio}`);
    if (hBefore.fim !== hAfter.fim) changes.push(`Fim expediente: ${hBefore.fim}→${hAfter.fim}`);
    if (JSON.stringify(hBefore.dias_semana) !== JSON.stringify(hAfter.dias_semana)) {
      changes.push(`Dias da semana alterados`);
    }
  }

  return changes.length > 0 ? changes : ['Sem alterações detectadas'];
}

export function exportAuditPdf(entries: AuditEntry[], clienteNome?: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('SENTINELLA MAP® — Histórico de Configuração SLA', margin, 13);

  doc.setFontSize(9);
  doc.setTextColor(180, 190, 210);
  const subtitle = clienteNome ? `Cliente: ${clienteNome}` : '';
  doc.text(`${subtitle}  |  Gerado em ${dateStr} às ${timeStr}`, margin, 21);

  y = 36;

  // ─── Summary ───
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo', margin, y);
  y += 6;

  const criacoes = entries.filter(e => e.action === 'INSERT').length;
  const alteracoes = entries.filter(e => e.action === 'UPDATE').length;
  const exclusoes = entries.filter(e => e.action === 'DELETE').length;

  const boxes = [
    { label: 'Total Registros', value: entries.length.toString() },
    { label: 'Criações', value: criacoes.toString() },
    { label: 'Alterações', value: alteracoes.toString() },
    { label: 'Exclusões', value: exclusoes.toString() },
  ];

  const boxW = (pageW - margin * 2 - 6 * (boxes.length - 1)) / boxes.length;
  boxes.forEach((m, i) => {
    const bx = margin + i * (boxW + 6);
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

  // ─── Detail Table ───
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhamento de Alterações', margin, y);
  y += 2;

  const ACTION_COLORS: Record<string, [number, number, number]> = {
    INSERT: [22, 163, 74],
    UPDATE: [59, 130, 246],
    DELETE: [220, 38, 38],
  };

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Data/Hora', 'Ação', 'Usuário', 'Alterações']],
    body: entries.map(entry => {
      const changes = diffConfig(entry.config_before, entry.config_after);
      return [
        new Date(entry.changed_at).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: '2-digit',
          hour: '2-digit', minute: '2-digit',
        }),
        ACTION_LABELS[entry.action] || entry.action,
        entry.usuario?.nome || 'Sistema',
        changes.join('\n'),
      ];
    }),
    styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 30 },
      3: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const entry = entries[data.row.index];
        if (entry) {
          data.cell.styles.textColor = ACTION_COLORS[entry.action] || [100, 100, 100];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // ─── Footer ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Sentinella MAP® — Histórico SLA — Página ${i}/${totalPages}`,
      pageW / 2,
      pageH - 6,
      { align: 'center' },
    );
  }

  doc.save(`historico-sla-${now.toISOString().slice(0, 10)}.pdf`);
}
