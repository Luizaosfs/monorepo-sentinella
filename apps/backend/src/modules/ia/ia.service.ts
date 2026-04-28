import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  constructor(private prisma: PrismaService) {}

  async identifyLarva(params: {
    imageBase64: string;
    contentType: string;
    depositoTipo?: string;
    vistoriaId?: string;
    clienteId: string;
  }): Promise<{ classificacao: string; confianca: number; descricao: string }> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: params.contentType,
                  data: params.imageBase64,
                },
              },
              {
                type: 'text',
                text: `Analise esta imagem de depósito em inspeção entomológica${params.depositoTipo ? ` (tipo: ${params.depositoTipo})` : ''}. Identifique se há larvas de Aedes aegypti presentes. Responda APENAS em JSON válido: {"classificacao": "positivo" | "negativo" | "inconclusivo", "confianca": 0.0-1.0, "descricao": "breve descrição do que foi observado"}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const text: string = data.content?.[0]?.text ?? '{}';

    try {
      const parsed = JSON.parse(text);
      return {
        classificacao: parsed.classificacao ?? 'inconclusivo',
        confianca: Number(parsed.confianca ?? 0.5),
        descricao: parsed.descricao ?? '',
      };
    } catch {
      return { classificacao: 'inconclusivo', confianca: 0, descricao: text };
    }
  }

  async insightsRegional(clienteId: string | null): Promise<{ insights: string[] }> {
    const focoWhere = clienteId ? { cliente_id: clienteId, deleted_at: null } : { deleted_at: null };
    const vistoriaWhere = clienteId ? { cliente_id: clienteId } : {};
    const [totalFocos, totalVistorias] = await this.prisma.client.$transaction([
      this.prisma.client.focos_risco.count({ where: focoWhere }),
      this.prisma.client.vistorias.count({ where: vistoriaWhere }),
    ]);

    const insights: string[] = [];
    if (totalFocos > 0) insights.push(`${totalFocos} foco(s) de risco ativo(s) registrado(s).`);
    if (totalVistorias > 0) insights.push(`${totalVistorias} vistoria(s) realizadas no período.`);
    if (!insights.length) insights.push('Nenhum dado disponível para o período.');

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Gere 3 insights estratégicos concisos (1 frase cada) para vigilância entomológica municipal: ${totalFocos} focos de risco, ${totalVistorias} vistorias realizadas. Formato JSON: {"insights": ["...", "...", "..."]}`,
          }],
        }),
      });
      if (resp.ok) {
        const d = (await resp.json()) as any;
        const raw: string = d.content?.[0]?.text ?? '';
        const text = raw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.insights)) return { insights: parsed.insights };
      } else {
        const errBody = await resp.text().catch(() => '');
        this.logger.error(`[insightsRegional] Anthropic HTTP ${resp.status}: ${errBody.slice(0, 200)}`);
      }
    } catch (err) {
      this.logger.error(`[insightsRegional] ${err instanceof Error ? err.message : String(err)}`);
    }

    return { insights };
  }

  async graficosRegionais(clienteIds: string[] | null): Promise<{
    graficos: {
      titulo: string;
      tipo: string;
      descricao?: string;
      dados: { nome: string; valor: number; cor?: string }[];
      cor_primaria?: string;
    }[];
    resumo: string;
    gerado_em: string;
  }> {
    const focoFilter = clienteIds
      ? { cliente_id: { in: clienteIds }, deleted_at: null as null }
      : { deleted_at: null as null };

    const graficos: {
      titulo: string;
      tipo: string;
      descricao?: string;
      dados: { nome: string; valor: number; cor?: string }[];
      cor_primaria?: string;
    }[] = [];

    // Chart 1: Focos por status (pie)
    const statusCounts = await this.prisma.client.focos_risco.groupBy({
      by: ['status'],
      where: focoFilter,
      _count: { id: true },
    });

    const STATUS_COLORS: Record<string, string> = {
      suspeita: '#f59e0b', em_triagem: '#3b82f6', aguarda_inspecao: '#8b5cf6',
      em_inspecao: '#06b6d4', confirmado: '#ef4444', em_tratamento: '#f97316',
      resolvido: '#22c55e', descartado: '#6b7280',
    };
    const STATUS_LABELS: Record<string, string> = {
      suspeita: 'Suspeita', em_triagem: 'Em triagem', aguarda_inspecao: 'Ag. inspeção',
      em_inspecao: 'Em inspeção', confirmado: 'Confirmado', em_tratamento: 'Em tratamento',
      resolvido: 'Resolvido', descartado: 'Descartado',
    };

    const dadosStatus = statusCounts
      .filter((r) => r._count.id > 0)
      .map((r) => ({ nome: STATUS_LABELS[r.status] ?? r.status, valor: r._count.id, cor: STATUS_COLORS[r.status] }));

    if (dadosStatus.length > 0) {
      graficos.push({ titulo: 'Focos por Status', tipo: 'pie', descricao: 'Distribuição dos focos por status atual', dados: dadosStatus, cor_primaria: '#7c3aed' });
    }

    // Chart 2: Focos por região (bar_horizontal, top 10)
    const regiaoFilter = clienteIds
      ? { cliente_id: { in: clienteIds }, deleted_at: null as null }
      : { deleted_at: null as null };
    const regioes = await this.prisma.client.regioes.findMany({
      where: regiaoFilter,
      select: { id: true, nome: true },
      take: 10,
    });

    if (regioes.length > 0) {
      const regiaoCounts = await Promise.all(
        regioes.map((r) => this.prisma.client.focos_risco.count({ where: { ...focoFilter, regiao_id: r.id } })),
      );
      const dadosRegiao = regioes
        .map((r, i) => ({ nome: r.nome, valor: regiaoCounts[i] }))
        .filter((d) => d.valor > 0)
        .sort((a, b) => b.valor - a.valor);

      if (dadosRegiao.length > 0) {
        graficos.push({ titulo: 'Focos por Região', tipo: 'bar_horizontal', descricao: 'Focos de risco por região (top 10)', dados: dadosRegiao, cor_primaria: '#7c3aed' });
      }
    }

    // Chart 3: Focos por município (quando há múltiplos clientes)
    if (!clienteIds || clienteIds.length !== 1) {
      const clientesFiltro = clienteIds ? { id: { in: clienteIds }, ativo: true } : { ativo: true };
      const clientes = await this.prisma.client.clientes.findMany({
        where: clientesFiltro,
        select: { id: true, nome: true },
        take: 10,
        orderBy: { nome: 'asc' },
      });

      if (clientes.length > 1) {
        const clienteCounts = await Promise.all(
          clientes.map((c) => this.prisma.client.focos_risco.count({ where: { cliente_id: c.id, deleted_at: null } })),
        );
        const dadosCliente = clientes
          .map((c, i) => ({ nome: c.nome, valor: clienteCounts[i] }))
          .filter((d) => d.valor > 0)
          .sort((a, b) => b.valor - a.valor);

        if (dadosCliente.length > 0) {
          graficos.push({ titulo: 'Focos por Município', tipo: 'bar', descricao: 'Total de focos por município', dados: dadosCliente, cor_primaria: '#7c3aed' });
        }
      }
    }

    const totalFocos = statusCounts.reduce((sum, r) => sum + r._count.id, 0);
    const ativos = statusCounts
      .filter((r) => !['resolvido', 'descartado'].includes(r.status))
      .reduce((sum, r) => sum + r._count.id, 0);

    return {
      graficos,
      resumo: `${totalFocos} focos registrados, ${ativos} ativos.`,
      gerado_em: new Date().toISOString(),
    };
  }

  async getAnaliseByLevantamento(
    levantamentoId: string,
    clienteId: string,
  ): Promise<{ analise: Record<string, unknown> | null }> {
    const raw = await this.prisma.client.levantamento_analise_ia.findFirst({
      where: { levantamento_id: levantamentoId, cliente_id: clienteId },
      orderBy: { processado_em: 'desc' },
    });
    if (!raw) return { analise: null };
    return {
      analise: {
        id: raw.id,
        levantamentoId: raw.levantamento_id,
        clienteId: raw.cliente_id,
        modelo: raw.modelo,
        totalFocos: raw.total_focos,
        totalClusters: raw.total_clusters,
        falsosPositivos: raw.falsos_positivos,
        sumario: raw.sumario,
        status: raw.status,
        erro: raw.erro,
        processadoEm: raw.processado_em,
        createdAt: raw.created_at,
      },
    };
  }

  async getInsights(
    clienteId: string,
    tipo?: string,
  ): Promise<{ insights: Record<string, unknown>[] }> {
    const now = new Date();
    const rows = await this.prisma.client.ia_insights.findMany({
      where: {
        cliente_id: clienteId,
        valido_ate: { gte: now },
        ...(tipo && { tipo }),
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });
    return {
      insights: rows.map((r) => ({
        id: r.id,
        clienteId: r.cliente_id,
        tipo: r.tipo,
        texto: r.texto,
        payload: r.payload,
        modelo: r.modelo,
        validoAte: r.valido_ate,
        createdAt: r.created_at,
      })),
    };
  }

  async triagemPosVoo(
    levantamentoId: string,
    clienteId: string,
  ): Promise<{
    totalFocos: number;
    totalClusters: number;
    falsosPositivos: number;
    sumario: string;
  }> {
    const itens = await this.prisma.client.levantamento_itens.findMany({
      where: { levantamento_id: levantamentoId, cliente_id: clienteId },
    });

    // Agrupa por grade 0.001° (~111m)
    const clusterMap = new Map<string, typeof itens>();
    for (const item of itens) {
      const lat = item.latitude ? Math.round(Number(item.latitude) / 0.001) : 0;
      const lng = item.longitude ? Math.round(Number(item.longitude) / 0.001) : 0;
      const key = `${lat},${lng}`;
      if (!clusterMap.has(key)) clusterMap.set(key, []);
      clusterMap.get(key)!.push(item);
    }

    const totalClusters = clusterMap.size;
    // yolo_confirmado não existe em levantamento_itens — falsos positivos não rastreáveis aqui
    const falsosPositivos = 0;
    const totalFocos = itens.length - falsosPositivos;

    let sumario = `Triagem pós-voo: ${totalFocos} focos confirmados em ${totalClusters} clusters, ${falsosPositivos} falsos positivos.`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `Gere um sumário executivo (2-3 frases) de triagem pós-voo de drone para vigilância entomológica: ${totalFocos} focos confirmados em ${totalClusters} agrupamentos geográficos, ${falsosPositivos} itens descartados como falso positivo.`,
            },
          ],
        }),
      });
      if (resp.ok) {
        const d = (await resp.json()) as any;
        sumario = d.content?.[0]?.text ?? sumario;
      }
    } catch {
      // usa sumário padrão
    }

    // Schema: retention_until obrigatório; levantamento_id não é @unique → findFirst + update/create
    const retentionUntil = new Date();
    retentionUntil.setDate(retentionUntil.getDate() + 90);

    const existente = await this.prisma.client.levantamento_analise_ia.findFirst({
      where: { levantamento_id: levantamentoId },
      select: { id: true },
    });

    if (existente) {
      await this.prisma.client.levantamento_analise_ia.update({
        where: { id: existente.id },
        data: {
          total_focos: totalFocos,
          total_clusters: totalClusters,
          falsos_positivos: falsosPositivos,
          sumario,
          processado_em: new Date(),
        },
      });
    } else {
      await this.prisma.client.levantamento_analise_ia.create({
        data: {
          levantamento_id: levantamentoId,
          cliente_id: clienteId,
          total_focos: totalFocos,
          total_clusters: totalClusters,
          falsos_positivos: falsosPositivos,
          sumario,
          retention_until: retentionUntil,
        },
      });
    }

    return { totalFocos, totalClusters, falsosPositivos, sumario };
  }
}
