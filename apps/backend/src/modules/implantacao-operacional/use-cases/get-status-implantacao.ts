import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  ImplantacaoStatusDto,
  ImplantacaoStatusVM,
} from '../view-model/implantacao-status.vm';

import { resolverDistribuicaoCanonica } from './shared/resolver-distribuicao-canonica';

@Injectable()
export class GetStatusImplantacao {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<ImplantacaoStatusDto> {
    // 1. Ciclo ativo do cliente
    const cicloAtivo = await this.prisma.client.ciclos.findFirst({
      where: { cliente_id: clienteId, status: 'ativo' },
      select: { id: true, numero: true, ano: true, status: true },
    });

    // 2. Total de quarteirões cadastrados (não deletados)
    const totalQuarteiroes = await this.prisma.client.bairros_quadras.count({
      where: { cliente_id: clienteId, deleted_at: null },
    });

    // 3. Distribuição CANÔNICA (território fixo: ciclo_id IS NULL; ciclo ativo
    //    apenas fallback). Quarteirões e agentes derivam da mesma fonte.
    const distribuicoes = await resolverDistribuicaoCanonica(
      this.prisma,
      clienteId,
      cicloAtivo?.id ?? null,
    );
    const quadraIds = [...new Set(distribuicoes.map(d => d.quadra_id))];
    const quarteiroesComAgente = quadraIds.length;
    const agentesComQuarteirao = new Set(distribuicoes.map(d => d.agente_id)).size;

    // 4. Total de agentes ativos do cliente
    const agentesRows = await this.prisma.client.$queryRaw<{ total: number }[]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT u.id)::int AS total
        FROM usuarios u
        INNER JOIN papeis_usuarios pu ON pu.usuario_id = u.auth_id
        WHERE u.cliente_id = ${clienteId}::uuid
          AND u.ativo = true
          AND pu.papel = 'agente'
      `,
    );
    const totalAgentesAtivos = Number(agentesRows[0]?.total ?? 0);

    // 5. Planejamento inicial mais antigo — MANUAL ou DRONE (drone também
    //    libera a operação; ambos são canais válidos de levantamento).
    const planejamento = await this.prisma.client.planejamentos.findFirst({
      where: {
        cliente_id: clienteId,
        tipo_levantamento: { in: ['MANUAL', 'DRONE'] },
        deleted_at: null,
      },
      orderBy: { created_at: 'asc' },
      select: { id: true, descricao: true, ativo: true, tipo_levantamento: true },
    });

    // 6. Imóveis elegíveis: ligados por quadra_id (FK canônica) às quadras
    //    distribuídas — não por casamento de texto livre `quarteirao`.
    let totalImoveisElegiveis = 0;
    if (quadraIds.length > 0) {
      totalImoveisElegiveis = await this.prisma.client.imoveis.count({
        where: {
          cliente_id: clienteId,
          deleted_at: null,
          quadra_id: { in: quadraIds },
        },
      });
    }

    // 7. Imóveis já visitados no ciclo ativo (distinct imovel_id, nas quadras
    //    distribuídas, casados por quadra_id).
    let totalImoveisJaVisitadosNoCiclo = 0;
    if (cicloAtivo && quadraIds.length > 0 && totalImoveisElegiveis > 0) {
      const visitadosRows = await this.prisma.client.$queryRaw<{ total: number }[]>(
        Prisma.sql`
          SELECT COUNT(DISTINCT v.imovel_id)::int AS total
          FROM vistorias v
          INNER JOIN imoveis i ON i.id = v.imovel_id
          WHERE v.cliente_id = ${clienteId}::uuid
            AND v.ciclo = ${cicloAtivo.numero}
            AND i.quadra_id = ANY(${quadraIds}::uuid[])
            AND v.deleted_at IS NULL
            AND i.deleted_at IS NULL
        `,
      );
      totalImoveisJaVisitadosNoCiclo = Number(visitadosRows[0]?.total ?? 0);
    }

    return ImplantacaoStatusVM.toHttp({
      clienteId,
      cicloAtivo,
      totalQuarteiroes,
      quarteiroesComAgente,
      totalAgentesAtivos,
      agentesComQuarteirao,
      planejamento,
      totalImoveisElegiveis,
      totalImoveisJaVisitadosNoCiclo,
    });
  }
}
