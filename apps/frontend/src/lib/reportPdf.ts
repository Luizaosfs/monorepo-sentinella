import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LevantamentoItem, Levantamento } from '@/types/database';
import { resolveMediaUrl } from '@/lib/media';

const RISK_ORDER: Record<string, number> = {
  critico: 0,
  alto: 1,
  medio: 2,
  baixo: 3,
};

const RISK_LABELS: Record<string, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};

const RISK_COLORS: Record<string, [number, number, number]> = {
  critico: [220, 38, 38],
  alto: [239, 68, 68],
  medio: [234, 179, 8],
  baixo: [34, 197, 94],
};

/** Load image as base64 data URL with timeout */
const loadImageAsBase64 = (url: string, timeoutMs = 5000): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { resolve(null); }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const MAX = 120; // thumbnail size
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
};

/** Pre-load images in batches to avoid too many parallel requests */
const preloadImages = async (
  items: LevantamentoItem[],
  onProgress?: (loaded: number, total: number) => void
): Promise<Map<string, string>> => {
  const imageMap = new Map<string, string>();
  const itemsWithImages = items.filter(i => {
    const url = resolveMediaUrl(i.image_url);
    return url !== null;
  });

  const BATCH_SIZE = 6;
  let loaded = 0;
  const total = itemsWithImages.length;

  for (let i = 0; i < itemsWithImages.length; i += BATCH_SIZE) {
    const batch = itemsWithImages.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (item) => {
        const url = resolveMediaUrl(item.image_url)!;
        const base64 = await loadImageAsBase64(url);
        return { id: item.id, base64 };
      })
    );
    for (const { id, base64 } of results) {
      if (base64) imageMap.set(id, base64);
      loaded++;
      onProgress?.(loaded, total);
    }
  }

  return imageMap;
};

interface ReportOptions {
  levantamento: Levantamento;
  itens: LevantamentoItem[];
  riskFilter?: string;
  includeImages?: boolean;
  onProgress?: (message: string) => void;
}

export const generateLevantamentoReport = async ({ levantamento, itens, riskFilter = 'todos', includeImages = true, onProgress }: ReportOptions) => {
  // Filter
  let filtered = riskFilter === 'todos'
    ? itens
    : itens.filter(i => (i.risco || '').toLowerCase() === riskFilter);

  // Sort by risk (highest first), then by score descending
  filtered = [...filtered].sort((a, b) => {
    const ra = RISK_ORDER[(a.risco || '').toLowerCase()] ?? 9;
    const rb = RISK_ORDER[(b.risco || '').toLowerCase()] ?? 9;
    if (ra !== rb) return ra - rb;
    return (b.score_final ?? 0) - (a.score_final ?? 0);
  });

  // Pre-load images (only if requested)
  let imageMap = new Map<string, string>();
  if (includeImages) {
    onProgress?.('Carregando imagens...');
    imageMap = await preloadImages(filtered, (loaded, total) => {
      onProgress?.(`Carregando imagens... ${loaded}/${total}`);
    });
  }
  onProgress?.('Gerando PDF...');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Sentinella Map — Relatório de Apontamentos', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${levantamento.titulo}  •  Voo: ${new Date(levantamento.data_voo).toLocaleDateString('pt-BR')}  •  Gerado: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    14, 19
  );

  const filterLabel = riskFilter === 'todos' ? 'Todos os riscos' : `Filtro: ${RISK_LABELS[riskFilter] || riskFilter}`;
  const imgCount = imageMap.size;
  doc.text(`${filterLabel}  •  ${filtered.length} itens  •  ${imgCount} imagens`, 14, 25);

  // Risk summary
  doc.setTextColor(30, 41, 59);
  const summaryY = 34;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo por Risco:', 14, summaryY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let summaryX = 60;
  for (const level of ['critico', 'alto', 'medio', 'baixo']) {
    const count = filtered.filter(i => (i.risco || '').toLowerCase() === level).length;
    if (count > 0) {
      const color = RISK_COLORS[level] || [100, 100, 100];
      doc.setFillColor(color[0], color[1], color[2]);
      doc.circle(summaryX, summaryY - 1.2, 1.5, 'F');
      doc.setTextColor(30, 41, 59);
      doc.text(`${RISK_LABELS[level]}: ${count}`, summaryX + 3, summaryY);
      summaryX += 35;
    }
  }

  const IMG_COL_W = 22;
  const IMG_H = 14;
  const IMG_W = 20;
  const ROW_MIN_H = includeImages ? IMG_H + 3 : undefined;

  const RISK_COL_IDX = includeImages ? 3 : 2;

  // Table data
  const tableData = filtered.map((item, idx) => {
    const row = [
      (idx + 1).toString(),
      item.item || '—',
      (item.risco || '—').charAt(0).toUpperCase() + (item.risco || '—').slice(1),
      item.prioridade || '—',
      item.score_final?.toString() ?? '—',
      item.sla_horas ? `${item.sla_horas}h` : '—',
      item.endereco_curto || '—',
      item.acao || '—',
    ];
    if (includeImages) row.unshift(''); // image placeholder
    return row;
  });

  const head = includeImages
    ? [['Imagem', '#', 'Item', 'Risco', 'Prioridade', 'Score', 'SLA', 'Endereço', 'Ação Recomendada']]
    : [['#', 'Item', 'Risco', 'Prioridade', 'Score', 'SLA', 'Endereço', 'Ação Recomendada']];

  const columnStyles: Record<number, Record<string, unknown>> = includeImages
    ? {
        0: { cellWidth: IMG_COL_W, halign: 'center' },
        1: { cellWidth: 8, halign: 'center' },
        2: { cellWidth: 36 },
        3: { cellWidth: 16 },
        4: { cellWidth: 18 },
        5: { cellWidth: 13, halign: 'center' },
        6: { cellWidth: 13, halign: 'center' },
        7: { cellWidth: 44 },
        8: { cellWidth: 'auto' },
      }
    : {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 40 },
        2: { cellWidth: 18 },
        3: { cellWidth: 20 },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 50 },
        7: { cellWidth: 'auto' },
      };

  autoTable(doc, {
    startY: summaryY + 5,
    head,
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2,
      ...(ROW_MIN_H ? { minCellHeight: ROW_MIN_H } : {}),
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === RISK_COL_IDX) {
        const risco = (data.cell.raw as string || '').toLowerCase();
        const color = RISK_COLORS[risco];
        if (color) {
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawCell: includeImages ? (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const rowIndex = data.row.index;
        const item = filtered[rowIndex];
        if (item) {
          const base64 = imageMap.get(item.id);
          if (base64) {
            const x = data.cell.x + (data.cell.width - IMG_W) / 2;
            const y = data.cell.y + (data.cell.height - IMG_H) / 2;
            try {
              doc.addImage(base64, 'JPEG', x, y, IMG_W, IMG_H);
            } catch { /* skip */ }
          } else {
            doc.setFontSize(6);
            doc.setTextColor(180, 180, 180);
            doc.text('sem imagem', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, { align: 'center', baseline: 'middle' });
          }
        }
      }
    } : undefined,
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}  •  Sentinella Map`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'center' }
      );
    },
  });

  // Save
  const safeName = levantamento.titulo.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
  const filterSuffix = riskFilter !== 'todos' ? `_${riskFilter}` : '';
  doc.save(`relatorio_${safeName}${filterSuffix}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
