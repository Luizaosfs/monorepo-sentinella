import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

export interface ResolverAgentePorQuadraResult {
  agenteId: string | null;
  agenteNome: string | null;
}

/**
 * Resolve o agente territorial responsável por uma quadra via `bairros_distribuicao`.
 *
 * O território do agente passou a ser FIXO (não mais por ciclo): o lookup primário
 * usa `ciclo_id IS NULL` (distribuição base) — mesma regra de
 * `EnsureAgentePodeAtuarNaQuadra.executeByQuadraId`.
 * Fallback defensivo: a distribuição mais recente da quadra (qualquer ciclo).
 *
 * Best-effort: nunca lança — retorna `agenteId: null` se nada for encontrado.
 */
@Injectable()
export class ResolverAgentePorQuadra {
  private readonly logger = new Logger(ResolverAgentePorQuadra.name);

  constructor(private prisma: PrismaService) {}

  async execute(
    clienteId: string,
    quadraId: string,
  ): Promise<ResolverAgentePorQuadraResult> {
    const fixo = await this.prisma.client.bairros_distribuicao.findFirst({
      where: { cliente_id: clienteId, quadra_id: quadraId, ciclo_id: null },
      select: { agente_id: true },
    });

    let agenteId: string | null = fixo?.agente_id ?? null;
    let fonte: 'fixo' | 'fallback' | 'nenhum' = fixo ? 'fixo' : 'nenhum';

    if (!agenteId) {
      const fallback = await this.prisma.client.bairros_distribuicao.findFirst({
        where: { cliente_id: clienteId, quadra_id: quadraId },
        orderBy: { created_at: 'desc' },
        select: { agente_id: true },
      });
      agenteId = fallback?.agente_id ?? null;
      fonte = fallback ? 'fallback' : 'nenhum';
    }

    let agenteNome: string | null = null;
    if (agenteId) {
      const usuario = await this.prisma.client.usuarios.findUnique({
        where: { id: agenteId },
        select: { nome: true },
      });
      agenteNome = usuario?.nome ?? null;
    }

    this.logger.debug(
      `[ResolverAgentePorQuadra] cliente=${clienteId} quadra=${quadraId} ` +
        `agente=${agenteId ?? 'null'} (fonte=${fonte})`,
    );

    return { agenteId, agenteNome };
  }
}
