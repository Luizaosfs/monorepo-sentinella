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

  async insightsRegional(clienteId: string): Promise<{ insights: string[] }> {
    const [totalFocos, totalVistorias] = await this.prisma.client.$transaction([
      this.prisma.client.focos_risco.count({ where: { cliente_id: clienteId, deleted_at: null } }),
      this.prisma.client.vistorias.count({ where: { cliente_id: clienteId } }),
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
        const text: string = d.content?.[0]?.text ?? '';
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.insights)) return { insights: parsed.insights };
      }
    } catch {
      // usa insights padrão
    }

    return { insights };
  }

  async graficosRegionais(clienteId: string): Promise<{ labels: string[]; values: number[]; tipo: string }> {
    const regioes = await this.prisma.client.regioes.findMany({
      where: { cliente_id: clienteId, deleted_at: null },
      select: { id: true, nome: true },
      take: 10,
    });

    const counts = await Promise.all(
      regioes.map((r) =>
        this.prisma.client.focos_risco.count({
          where: { cliente_id: clienteId, regiao_id: r.id, deleted_at: null },
        }),
      ),
    );

    return {
      tipo: 'focos_por_regiao',
      labels: regioes.map((r) => r.nome),
      values: counts,
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
