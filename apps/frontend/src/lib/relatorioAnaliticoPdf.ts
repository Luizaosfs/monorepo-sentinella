/**
 * relatorioAnaliticoPdf — Geração de PDF para o Relatório Executivo Analítico (P8.3)
 *
 * Usa jsPDF + jspdf-autotable (já instalados).
 * Entrada: payload JSON de rpc_gerar_relatorio_analitico.
 * Saída: download do arquivo PDF.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Paleta ──────────────────────────────────────────────────────────────────

const DARK: [number, number, number]   = [15,  23,  42];
const BLUE: [number, number, number]   = [37,  99,  235];
const GREEN: [number, number, number]  = [22,  163, 74];
const ORANGE: [number, number, number] = [234, 88,  12];
const RED: [number, number, number]    = [220, 38,  38];
const MUTED: [number, number, number]  = [100, 116, 139];
const ALT: [number, number, number]    = [248, 250, 252];

// ─── Labels ──────────────────────────────────────────────────────────────────

const VD_LABEL: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica', inconclusivo: 'Inconclusivo',
};
const AS_LABEL: Record<string, string> = {
  nenhum: 'Nenhum', atencao: 'Atenção', urgente: 'Urgente', inconclusivo: 'Inconclusivo',
};
const RO_LABEL: Record<string, string> = {
  visitado: 'Visitado',
  sem_acesso: 'Sem acesso (1ª vez)',
  sem_acesso_retorno: 'Sem acesso (2ª+ vez)',
  inconclusivo: 'Inconclusivo',
};
const RV_LABEL: Record<string, string> = {
  baixo: 'Baixo', medio: 'Médio', alto: 'Alto', critico: 'Crítico', inconclusivo: 'Inconclusivo',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function n(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

function addPageFooter(doc: jsPDF, pages: number, geradoEm: string): void {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, H - 12, W - 14, H - 12);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(
      `Sentinella — Sistema de Monitoramento Epidemiológico · Gerado em ${geradoEm}`,
      14, H - 7,
    );
    doc.text(`Página ${i} / ${pages}`, W - 14, H - 7, { align: 'right' });
  }
}

function secTitle(doc: jsPDF, title: string, y: number, margin = 14): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(title, margin, y);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 1.5, margin + doc.getTextWidth(title), y + 1.5);
  return y + 8;
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin = 14): number {
  const H = doc.internal.pageSize.getHeight();
  if (y + needed > H - 20) {
    doc.addPage();
    return margin + 8;
  }
  return y;
}

// ─── Tipo do payload ──────────────────────────────────────────────────────────

interface RelatorioPdf {
  meta: {
    municipio: string;
    cidade?: string;
    uf?: string;
    periodo_inicio: string;
    periodo_fim: string;
    gerado_em: string;
  };
  resumo: {
    total_vistorias?: number;
    p1_count?: number;
    p2_count?: number;
    p3_count?: number;
    p4_count?: number;
    visitados_count?: number;
    sem_acesso_count?: number;
    sem_acesso_retorno_count?: number;
    taxa_acesso_pct?: number | null;
    alertas_urgentes?: number;
    alertas_atencao?: number;
    vulnerabilidade_alta_count?: number;
    vulnerabilidade_critica_count?: number;
    risco_vetorial_alto_count?: number;
  };
  risco_territorial: Array<{
    bairro: string;
    total_vistorias: number;
    criticos_count: number;
    risco_vetorial_alto: number;
    vulnerabilidade_alta: number;
    alertas_saude: number;
    sem_acesso_total: number;
    pct_criticos: number | null;
  }>;
  vulnerabilidade: Array<{ vulnerabilidade_domiciliar: string; total: number }>;
  alerta_saude: Array<{ alerta_saude: string; total: number }>;
  resultado_operacional: Array<{ resultado_operacional: string; total: number }>;
  imoveis_criticos: Array<{
    logradouro: string | null;
    numero: string | null;
    bairro: string;
    prioridade_final: string | null;
    resultado_operacional: string | null;
    vulnerabilidade_domiciliar: string | null;
    alerta_saude: string | null;
    risco_vetorial: string | null;
    dimensoes_criticas_count: number;
  }>;
}

// ─── Gerador principal ────────────────────────────────────────────────────────

export function gerarRelatorioAnaliticoPdf(payload: RelatorioPdf): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const margin = 14;

  const periodoInicio = format(new Date(payload.meta.periodo_inicio + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  const periodoFim    = format(new Date(payload.meta.periodo_fim    + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  const geradoEm      = new Date(payload.meta.gerado_em).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const municipioStr = [
    payload.meta.municipio,
    payload.meta.cidade && payload.meta.uf
      ? `${payload.meta.cidade} — ${payload.meta.uf}`
      : payload.meta.cidade ?? payload.meta.uf ?? null,
  ].filter(Boolean).join(' · ');

  const r = payload.resumo;

  // ────────────────────────────────────────────────────────────────────────────
  // CAPA
  // ────────────────────────────────────────────────────────────────────────────

  // Barra azul superior
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 52, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('Relatório Executivo', margin, 22);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Monitoramento Epidemiológico — Sentinella', margin, 30);

  doc.setFontSize(9);
  doc.setTextColor(186, 230, 253);
  doc.text(municipioStr, margin, 38);
  doc.text(`Período: ${periodoInicio} a ${periodoFim}`, margin, 44);
  doc.text(`Gerado em: ${geradoEm}`, W - margin, 44, { align: 'right' });

  let y = 64;

  // ────────────────────────────────────────────────────────────────────────────
  // SEÇÃO 2 — RESUMO EXECUTIVO
  // ────────────────────────────────────────────────────────────────────────────

  y = secTitle(doc, '1. Resumo Executivo', y);

  // KPI grid (2 colunas × 3 linhas)
  const kpiItems = [
    { label: 'Total de vistorias',     value: String(n(r.total_vistorias)), color: DARK },
    { label: 'Taxa de acesso',         value: r.taxa_acesso_pct != null ? `${r.taxa_acesso_pct}%` : '—', color: n(r.taxa_acesso_pct) < 70 ? ORANGE : GREEN },
    { label: 'Imóveis P1 (crítico)',   value: String(n(r.p1_count)), color: n(r.p1_count) > 0 ? RED : GREEN },
    { label: 'Imóveis P2 (alto)',      value: String(n(r.p2_count)), color: n(r.p2_count) > 0 ? ORANGE : GREEN },
    { label: 'Alertas urgentes saúde', value: String(n(r.alertas_urgentes)), color: n(r.alertas_urgentes) > 0 ? RED : GREEN },
    { label: 'Vulnerabilidade alta/crítica', value: String(n(r.vulnerabilidade_alta_count)), color: n(r.vulnerabilidade_alta_count) > 0 ? ORANGE : GREEN },
  ];

  const colW = (W - margin * 2 - 6) / 2;
  kpiItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * (colW + 6);
    const ky = y + row * 18;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, ky, colW, 15, 2, 2, 'F');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...item.color);
    doc.text(item.value, x + 4, ky + 9);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(item.label, x + 4, ky + 13.5);
  });

  y += 60;

  // Texto situacional
  const alertas: string[] = [];
  if (n(r.p1_count) > 0) alertas.push(`• ${r.p1_count} imóvel(is) em situação CRÍTICA exigem intervenção imediata.`);
  if (n(r.alertas_urgentes) > 0) alertas.push(`• ${r.alertas_urgentes} domicílio(s) com sinais de dengue em ≥50% dos moradores.`);
  if (r.taxa_acesso_pct != null && r.taxa_acesso_pct < 70) alertas.push(`• Taxa de acesso abaixo de 70% — revisar estratégia de campo.`);
  if (n(r.vulnerabilidade_critica_count) > 0) alertas.push(`• ${r.vulnerabilidade_critica_count} domicílio(s) com vulnerabilidade CRÍTICA (incapacitado no domicílio).`);

  if (alertas.length > 0) {
    y = ensureSpace(doc, y, 10 + alertas.length * 6);
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(252, 165, 165);
    doc.roundedRect(margin, y, W - margin * 2, 8 + alertas.length * 5.5, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...RED);
    doc.text('Pontos de atenção:', margin + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    alertas.forEach((txt, i) => {
      doc.text(txt, margin + 3, y + 10 + i * 5.5);
    });
    y += 14 + alertas.length * 5.5;
  }

  y += 4;

  // ────────────────────────────────────────────────────────────────────────────
  // SEÇÃO 3 — SITUAÇÃO TERRITORIAL
  // ────────────────────────────────────────────────────────────────────────────

  y = ensureSpace(doc, y, 40);
  y = secTitle(doc, '2. Situação Territorial por Bairro', y);

  if (payload.risco_territorial.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('Sem dados territoriais para o período.', margin, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Bairro', 'Vistorias', 'P1+P2', '% Críticos', 'Vetorial ↑', 'Vulnerável', 'Alertas', 'Sem acesso']],
      body: payload.risco_territorial.slice(0, 20).map((r) => [
        r.bairro,
        String(r.total_vistorias),
        String(r.criticos_count),
        r.pct_criticos != null ? `${r.pct_criticos}%` : '—',
        String(r.risco_vetorial_alto),
        String(r.vulnerabilidade_alta),
        String(r.alertas_saude),
        String(r.sem_acesso_total),
      ]),
      headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: DARK },
      alternateRowStyles: { fillColor: ALT },
      columnStyles: {
        1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' },
        4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' },
        7: { halign: 'center' },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          const val = payload.risco_territorial[data.row.index]?.criticos_count ?? 0;
          if (val > 0) data.cell.styles.textColor = val > 3 ? RED : ORANGE;
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SEÇÃO 4 — VULNERABILIDADE + SEÇÃO 5 — ALERTAS (lado a lado em texto)
  // ────────────────────────────────────────────────────────────────────────────

  y = ensureSpace(doc, y, 30);
  y = secTitle(doc, '3. Vulnerabilidade Domiciliar', y);

  if (payload.vulnerabilidade.length === 0) {
    doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text('Sem dados de vulnerabilidade para o período.', margin, y); y += 8;
  } else {
    const totalVuln = payload.vulnerabilidade.reduce((s, v) => s + v.total, 0);
    payload.vulnerabilidade.forEach((v) => {
      y = ensureSpace(doc, y, 7);
      const pct = totalVuln > 0 ? Math.round((v.total / totalVuln) * 100) : 0;
      const label = VD_LABEL[v.vulnerabilidade_domiciliar] ?? v.vulnerabilidade_domiciliar;
      const barMax = W - margin * 2 - 50;
      const barW = Math.max(2, (barMax * pct) / 100);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK);
      doc.text(`${label}`, margin, y);
      doc.text(`${v.total} (${pct}%)`, W - margin, y, { align: 'right' });

      const barColor: [number, number, number] =
        v.vulnerabilidade_domiciliar === 'critica' ? RED :
        v.vulnerabilidade_domiciliar === 'alta' ? ORANGE :
        v.vulnerabilidade_domiciliar === 'media' ? [202, 138, 4] : GREEN;

      doc.setFillColor(226, 232, 240);
      doc.rect(margin, y + 1.5, barMax, 3, 'F');
      doc.setFillColor(...barColor);
      doc.rect(margin, y + 1.5, barW, 3, 'F');
      y += 8;
    });
    y += 2;
  }

  y = ensureSpace(doc, y, 30);
  y = secTitle(doc, '4. Alertas de Saúde', y);

  if (payload.alerta_saude.length === 0) {
    doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text('Sem dados de alerta de saúde para o período.', margin, y); y += 8;
  } else {
    const totalAS = payload.alerta_saude.reduce((s, v) => s + v.total, 0);
    payload.alerta_saude.forEach((v) => {
      y = ensureSpace(doc, y, 7);
      const pct = totalAS > 0 ? Math.round((v.total / totalAS) * 100) : 0;
      const label = AS_LABEL[v.alerta_saude] ?? v.alerta_saude;
      const barMax = W - margin * 2 - 50;
      const barW = Math.max(2, (barMax * pct) / 100);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK);
      doc.text(`${label}`, margin, y);
      doc.text(`${v.total} (${pct}%)`, W - margin, y, { align: 'right' });

      const barColor: [number, number, number] =
        v.alerta_saude === 'urgente' ? RED :
        v.alerta_saude === 'atencao' ? [202, 138, 4] : GREEN;

      doc.setFillColor(226, 232, 240);
      doc.rect(margin, y + 1.5, barMax, 3, 'F');
      doc.setFillColor(...barColor);
      doc.rect(margin, y + 1.5, barW, 3, 'F');
      y += 8;
    });
    y += 2;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SEÇÃO 6 — EFICIÊNCIA OPERACIONAL
  // ────────────────────────────────────────────────────────────────────────────

  y = ensureSpace(doc, y, 30);
  y = secTitle(doc, '5. Eficiência Operacional', y);

  if (payload.resultado_operacional.length === 0) {
    doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text('Sem dados operacionais para o período.', margin, y); y += 8;
  } else {
    const totalRO = payload.resultado_operacional.reduce((s, v) => s + v.total, 0);
    payload.resultado_operacional.forEach((v) => {
      y = ensureSpace(doc, y, 7);
      const pct = totalRO > 0 ? Math.round((v.total / totalRO) * 100) : 0;
      const label = RO_LABEL[v.resultado_operacional] ?? v.resultado_operacional;
      const barMax = W - margin * 2 - 55;
      const barW = Math.max(2, (barMax * pct) / 100);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK);
      doc.text(`${label}`, margin, y);
      doc.text(`${v.total} (${pct}%)`, W - margin, y, { align: 'right' });

      const barColor: [number, number, number] =
        v.resultado_operacional === 'visitado' ? GREEN :
        v.resultado_operacional === 'sem_acesso_retorno' ? ORANGE : [202, 138, 4];

      doc.setFillColor(226, 232, 240);
      doc.rect(margin, y + 1.5, barMax, 3, 'F');
      doc.setFillColor(...barColor);
      doc.rect(margin, y + 1.5, barW, 3, 'F');
      y += 8;
    });
    y += 2;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SEÇÃO 8 — IMÓVEIS CRÍTICOS (P1/P2)
  // ────────────────────────────────────────────────────────────────────────────

  if (payload.imoveis_criticos.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = secTitle(doc, '6. Imóveis Críticos (P1/P2)', y);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Endereço', 'Bairro', 'Prior.', 'Vetorial', 'Vulnerab.', 'Saúde', 'Acesso']],
      body: payload.imoveis_criticos.slice(0, 30).map((im) => [
        [im.logradouro, im.numero].filter(Boolean).join(', ') || '—',
        im.bairro,
        im.prioridade_final ?? '—',
        RV_LABEL[im.risco_vetorial ?? ''] ?? '—',
        VD_LABEL[im.vulnerabilidade_domiciliar ?? ''] ?? '—',
        AS_LABEL[im.alerta_saude ?? ''] ?? '—',
        RO_LABEL[im.resultado_operacional ?? ''] ?? '—',
      ]),
      headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: DARK },
      alternateRowStyles: { fillColor: ALT },
      columnStyles: {
        2: { halign: 'center' }, 3: { halign: 'center' },
        4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' },
      },
      didParseCell(data) {
        if (data.section !== 'body') return;
        if (data.column.index === 2) {
          const p = payload.imoveis_criticos[data.row.index]?.prioridade_final;
          if (p === 'P1') data.cell.styles.textColor = RED;
          if (p === 'P2') data.cell.styles.textColor = ORANGE;
        }
        if (data.column.index === 3) {
          const rv = payload.imoveis_criticos[data.row.index]?.risco_vetorial;
          if (rv === 'critico') data.cell.styles.textColor = RED;
          if (rv === 'alto') data.cell.styles.textColor = ORANGE;
        }
        if (data.column.index === 5) {
          const as_ = payload.imoveis_criticos[data.row.index]?.alerta_saude;
          if (as_ === 'urgente') data.cell.styles.textColor = RED;
        }
      },
    });
  }

  // ─── Rodapé em todas as páginas ──────────────────────────────────────────────
  const pageCount = (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1;
  addPageFooter(doc, pageCount, geradoEm);

  // ─── Salvar ──────────────────────────────────────────────────────────────────
  const safeMunicipio = (payload.meta.municipio ?? 'municipio')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  doc.save(`sentinella-relatorio-${safeMunicipio}-${payload.meta.periodo_fim}.pdf`);
}
