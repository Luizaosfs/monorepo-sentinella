import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface KpisRelatorio {
  focos_pendentes?: number | null;
  focos_em_atendimento?: number | null;
  slas_vencidos?: number | null;
  slas_vencendo_2h?: number | null;
  imoveis_criticos?: number | null;
  imoveis_muito_alto?: number | null;
  agentes_ativos_hoje?: number | null;
  vistorias_hoje?: number | null;
  score_medio_municipio?: number | null;
  denuncias_ultimas_24h?: number | null;
  casos_hoje?: number | null;
}

interface ImovelParaRelatorio {
  imovel_id: string;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  quarteirao?: string | null;
  score?: number | null;
  classificacao?: string | null;
  focos_ativos_count?: number | null;
  sla_mais_urgente?: string | null;
}

const CLASS_LABEL: Record<string, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  muito_alto: 'Muito Alto',
  critico: 'Crítico',
};

const CLASS_COLOR: Record<string, [number, number, number]> = {
  baixo: [16, 185, 129],
  medio: [245, 158, 11],
  alto: [249, 115, 22],
  muito_alto: [239, 68, 68],
  critico: [185, 28, 28],
};

export function gerarRelatorioPdf(
  kpis: KpisRelatorio | null | undefined,
  imoveis: ImovelParaRelatorio[],
  nomeCliente?: string,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dataHoje = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const horaHoje = format(new Date(), 'HH:mm');
  const pageW = doc.internal.pageSize.getWidth();

  // ── Cabeçalho ────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Sentinella — Relatório Operacional', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(nomeCliente ? `${nomeCliente} · ${dataHoje} · ${horaHoje}` : `${dataHoje} · ${horaHoje}`, 14, 21);

  // ── Subtítulo ─────────────────────────────────────────────────────────────
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo do dia', 14, 38);

  // ── KPI grid (2 colunas) ──────────────────────────────────────────────────
  const kpiItems = [
    { label: 'Focos pendentes',    value: kpis?.focos_pendentes ?? 0,       sub: `${kpis?.focos_em_atendimento ?? 0} em atendimento` },
    { label: 'SLAs vencidos',      value: kpis?.slas_vencidos ?? 0,          sub: `${kpis?.slas_vencendo_2h ?? 0} vencem em 2h` },
    { label: 'Imóveis críticos',   value: kpis?.imoveis_criticos ?? 0,       sub: `${kpis?.imoveis_muito_alto ?? 0} muito alto` },
    { label: 'Vistorias hoje',     value: kpis?.vistorias_hoje ?? 0,         sub: `${kpis?.agentes_ativos_hoje ?? 0} agentes em campo` },
    { label: 'Denúncias (24h)',    value: kpis?.denuncias_ultimas_24h ?? 0,  sub: 'canal cidadão' },
    { label: 'Casos notificados',  value: kpis?.casos_hoje ?? 0,            sub: 'hoje' },
  ];

  const colW = (pageW - 28) / 2;
  let y = 44;

  kpiItems.forEach((item, idx) => {
    const x = idx % 2 === 0 ? 14 : 14 + colW + 4;
    if (idx % 2 === 0 && idx > 0) y += 18;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, colW, 15, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, colW, 15, 2, 2, 'S');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(item.value), x + 4, y + 9);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + 4, y + 13.5);
  });

  y += 28;

  // ── Score médio ───────────────────────────────────────────────────────────
  if (kpis?.score_medio_municipio != null) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Score territorial médio do município: ${kpis.score_medio_municipio.toFixed(1)} / 100`, 14, y);
    y += 8;
  }

  // ── Tabela de imóveis prioritários ────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Imóveis prioritários', 14, y + 2);
  y += 8;

  if (imoveis.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Nenhum imóvel em nível crítico ou alto no momento.', 14, y + 4);
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Endereço', 'Bairro', 'Score', 'Classificação', 'Focos', 'SLA']],
      body: imoveis.slice(0, 20).map((im) => {
        const slaStr = im.sla_mais_urgente
          ? format(new Date(im.sla_mais_urgente), 'dd/MM HH:mm')
          : '—';
        return [
          [im.logradouro, im.numero].filter(Boolean).join(', ') || 'Não informado',
          im.bairro ?? '—',
          im.score != null ? String(im.score) : '—',
          CLASS_LABEL[im.classificacao ?? ''] ?? (im.classificacao ?? '—'),
          String(im.focos_ativos_count ?? 0),
          slaStr,
        ];
      }),
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        2: { halign: 'center' },
        4: { halign: 'center' },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          const cls = imoveis[data.row.index]?.classificacao ?? '';
          const rgb = CLASS_COLOR[cls];
          if (rgb) data.cell.styles.textColor = rgb;
        }
        if (data.section === 'body' && data.column.index === 4) {
          const focos = imoveis[data.row.index]?.focos_ativos_count ?? 0;
          if (focos > 0) data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Gerado pelo Sentinella em ${dataHoje} às ${horaHoje}. Documento confidencial.`,
    pageW / 2,
    pageH - 8,
    { align: 'center' },
  );

  doc.save(`sentinella-relatorio-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
