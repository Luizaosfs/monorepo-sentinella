import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface NotificacaoPdfData {
  imovel: {
    logradouro: string;
    numero?: string | null;
    bairro: string;
    quarteirao?: string | null;
    tipo_imovel: string;
  };
  cliente: {
    nome: string;
    codigo_ibge?: string | null;
  };
  numero_protocolo: string;
  agente_nome: string;
  total_tentativas: number;
  dias_periodo: number;
}

export function gerarNotificacaoFormalPdf(data: NotificacaoPdfData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const lineH = 7;

  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  let y = margin;

  // Header — municipality name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`PREFEITURA MUNICIPAL DE ${data.cliente.nome.toUpperCase()}`, pageW / 2, y, { align: 'center' });
  y += lineH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('SECRETARIA MUNICIPAL DE SAÚDE', pageW / 2, y, { align: 'center' });
  y += lineH;

  doc.text('SERVIÇO DE VIGILÂNCIA EPIDEMIOLÓGICA', pageW / 2, y, { align: 'center' });
  y += lineH * 1.5;

  // Divider
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += lineH;

  // Document title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`NOTIFICAÇÃO SANITÁRIA Nº ${data.numero_protocolo}`, pageW / 2, y, { align: 'center' });
  y += lineH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Data: ${today}`, pageW / 2, y, { align: 'center' });
  y += lineH * 2;

  // Addressed party
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('NOTIFICADO:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Proprietário/responsável pelo imóvel', margin + 32, y);
  y += lineH;

  // Address
  const enderecoCompleto = [data.imovel.logradouro, data.imovel.numero].filter(Boolean).join(', ');
  doc.setFont('helvetica', 'bold');
  doc.text('Endereço:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${enderecoCompleto} — ${data.imovel.bairro}`, margin + 24, y);
  y += lineH;

  doc.setFont('helvetica', 'bold');
  doc.text('Quarteirão:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.imovel.quarteirao ?? '—'}`, margin + 28, y);
  doc.setFont('helvetica', 'bold');
  doc.text('   Tipo:', margin + 60, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.imovel.tipo_imovel}`, margin + 76, y);
  y += lineH * 2;

  // Body text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const bodyText =
    `Com base nas vistorias realizadas pelo Programa Nacional de Controle\n` +
    `da Dengue (PNCD), o imóvel acima apresenta ${data.total_tentativas} tentativas de vistoria\n` +
    `sem acesso nos últimos ${data.dias_periodo} dias.`;

  const bodyLines = doc.splitTextToSize(bodyText, pageW - margin * 2);
  doc.text(bodyLines, margin, y);
  y += bodyLines.length * lineH + lineH;

  const penaltyText =
    `O não atendimento à presente notificação, no prazo de 5 (cinco) dias\n` +
    `úteis, sujeitará o infrator às penalidades previstas na Lei Federal\n` +
    `nº 6.437/77 e legislação municipal vigente.`;

  const penaltyLines = doc.splitTextToSize(penaltyText, pageW - margin * 2);
  doc.text(penaltyLines, margin, y);
  y += penaltyLines.length * lineH + lineH * 2;

  // Divider
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += lineH;

  // Signature area
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Agente responsável: ${data.agente_nome}`, margin, y);
  doc.text('Data: ___/___/______', pageW - margin - 50, y);
  y += lineH * 1.5;

  doc.setFont('helvetica', 'normal');
  doc.text('Assinatura:', margin, y);
  doc.setDrawColor(100, 100, 100);
  doc.line(margin + 26, y, pageW - margin - 20, y);
  y += lineH * 3;

  // Footer box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, pageW - margin * 2, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Sentinella · Sistema de Vigilância Epidemiológica',
    pageW / 2,
    y + 9,
    { align: 'center' }
  );

  // Page footer
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `Documento gerado automaticamente pelo Sentinella · ${today} · Protocolo: ${data.numero_protocolo}`,
    pageW / 2,
    pageH - 6,
    { align: 'center' }
  );

  // Suppress unused import warning — autoTable is used via side-effect on jsPDF prototype
  void autoTable;

  doc.save(`notificacao-${data.numero_protocolo}.pdf`);
}
