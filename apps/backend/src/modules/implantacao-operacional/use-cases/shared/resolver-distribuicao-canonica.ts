import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

export interface DistribuicaoLinha {
  quadra_id: string;
  agente_id: string;
}

/**
 * Território do agente é FIXO: a linha canônica de "quem é o agente desta
 * quadra" em `bairros_distribuicao` é a que tem `ciclo_id IS NULL`. O ciclo
 * ativo é apenas fallback (mesma regra de `ResolverAgentePorQuadra` —
 * memória de produto `project_territorio_agente_fixo`, mai/2026).
 *
 * Não tratar `ciclo_id` como dimensão obrigatória da distribuição: filtrar
 * estritamente por `ciclo_id = <ciclo ativo>` ignora todo o território fixo
 * e trava a implantação operacional mesmo com a distribuição feita.
 */
export async function resolverDistribuicaoCanonica(
  prisma: PrismaService,
  clienteId: string,
  cicloId: string | null,
): Promise<DistribuicaoLinha[]> {
  const fixas = await prisma.client.bairros_distribuicao.findMany({
    where: { cliente_id: clienteId, ciclo_id: null },
    select: { quadra_id: true, agente_id: true },
  });
  if (fixas.length > 0) return fixas;

  if (!cicloId) return [];

  return prisma.client.bairros_distribuicao.findMany({
    where: { cliente_id: clienteId, ciclo_id: cicloId },
    select: { quadra_id: true, agente_id: true },
  });
}
