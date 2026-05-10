import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  ImplantacaoStatusDto,
  ImplantacaoStatusVM,
} from '../view-model/implantacao-status.vm';

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

    // 3. Quarteirões com agente atribuído no ciclo ativo
    let quarteiroesComAgente = 0;
    let codigosQuarteiroes: string[] = [];
    if (cicloAtivo) {
      const distribuicoes = await this.prisma.client.bairros_distribuicao.findMany({
        where: { cliente_id: clienteId, ciclo_id: cicloAtivo.id },
        select: { quadra_rel: { select: { codigo: true } } },
      });
      quarteiroesComAgente = distribuicoes.length;
      codigosQuarteiroes = distribuicoes.map(d => d.quadra_rel!.codigo);
    }

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

    // 5. Agentes com ao menos um quarteirão no ciclo ativo
    let agentesComQuarteirao = 0;
    if (cicloAtivo) {
      const agentesDistRows = await this.prisma.client.$queryRaw<{ total: number }[]>(
        Prisma.sql`
          SELECT COUNT(DISTINCT agente_id)::int AS total
          FROM bairros_distribuicao
          WHERE cliente_id = ${clienteId}::uuid
            AND ciclo_id = ${cicloAtivo.id}::uuid
        `,
      );
      agentesComQuarteirao = Number(agentesDistRows[0]?.total ?? 0);
    }

    // 6. Planejamento MANUAL mais antigo (candidato ao "levantamento inicial")
    const planejamento = await this.prisma.client.planejamentos.findFirst({
      where: {
        cliente_id: clienteId,
        tipo_levantamento: 'MANUAL',
        deleted_at: null,
      },
      orderBy: { created_at: 'asc' },
      select: { id: true, descricao: true, ativo: true },
    });

    // 7. Imóveis elegíveis: pertencentes aos quarteirões distribuídos do ciclo ativo
    let totalImoveisElegiveis = 0;
    if (cicloAtivo && codigosQuarteiroes.length > 0) {
      totalImoveisElegiveis = await this.prisma.client.imoveis.count({
        where: {
          cliente_id: clienteId,
          deleted_at: null,
          quarteirao: { in: codigosQuarteiroes },
        },
      });
    }

    // 8. Imóveis já visitados no ciclo ativo (distinct por imovel_id, nos quarteirões distribuídos)
    let totalImoveisJaVisitadosNoCiclo = 0;
    if (cicloAtivo && codigosQuarteiroes.length > 0 && totalImoveisElegiveis > 0) {
      const visitadosRows = await this.prisma.client.$queryRaw<{ total: number }[]>(
        Prisma.sql`
          SELECT COUNT(DISTINCT v.imovel_id)::int AS total
          FROM vistorias v
          INNER JOIN imoveis i ON i.id = v.imovel_id
          WHERE v.cliente_id = ${clienteId}::uuid
            AND v.ciclo = ${cicloAtivo.numero}
            AND i.quarteirao = ANY(${codigosQuarteiroes}::text[])
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
