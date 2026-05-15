import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ImplantacaoException } from '../errors/implantacao.exception';

import { resolverDistribuicaoCanonica } from './shared/resolver-distribuicao-canonica';

export interface GerarOperacaoInicialResult {
  planejamentoId: string;
  cicloId: string;
  totalImoveisElegiveis: number;
  totalImoveisIncluidos: number;
  totalAgentesComRota: number;
  totalAgentesSemRota: number;
  mensagem: string;
}

@Injectable()
export class GerarOperacaoInicial {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<GerarOperacaoInicialResult> {
    // 1. Ciclo ativo obrigatório
    const cicloAtivo = await this.prisma.client.ciclos.findFirst({
      where: { cliente_id: clienteId, status: 'ativo' },
      select: { id: true, numero: true },
    });
    if (!cicloAtivo) throw ImplantacaoException.semCicloAtivo();

    // 2. Ao menos um agente ativo
    const totalAgentes = await this.prisma.client.usuarios.count({
      where: {
        cliente_id: clienteId,
        ativo: true,
        papeis_usuarios: { some: { papel: 'agente' } },
      },
    });
    if (totalAgentes === 0) throw ImplantacaoException.semAgentes();

    // 3. Ao menos um quarteirão distribuído (território fixo canônico:
    //    ciclo_id IS NULL; ciclo ativo apenas fallback)
    const distribuicoes = await resolverDistribuicaoCanonica(
      this.prisma,
      clienteId,
      cicloAtivo.id,
    );
    if (distribuicoes.length === 0) throw ImplantacaoException.semDistribuicao();

    // 4. Ao menos um imóvel elegível, ligado por quadra_id (FK canônica)
    const quadraIds = [...new Set(distribuicoes.map(d => d.quadra_id))];
    const totalImoveisElegiveis = await this.prisma.client.imoveis.count({
      where: {
        cliente_id: clienteId,
        deleted_at: null,
        quadra_id: { in: quadraIds },
      },
    });
    if (totalImoveisElegiveis === 0) throw ImplantacaoException.semImoveis();

    // 5. Idempotente: garantir um planejamento inicial ATIVO. Drone também
    //    libera — qualquer plano MANUAL ou DRONE existente é reaproveitado
    //    (ativado se inativo). Só cria um MANUAL novo se não existir nenhum.
    let planejamento = await this.prisma.client.planejamentos.findFirst({
      where: {
        cliente_id: clienteId,
        tipo_levantamento: { in: ['MANUAL', 'DRONE'] },
        deleted_at: null,
      },
      orderBy: { created_at: 'asc' },
      select: { id: true, ativo: true },
    });

    if (!planejamento) {
      planejamento = await this.prisma.client.planejamentos.create({
        data: {
          cliente_id: clienteId,
          descricao: `Levantamento inicial - Ciclo ${cicloAtivo.numero}`,
          tipo_levantamento: 'MANUAL',
          ativo: true,
          data_planejamento: new Date(),
        },
        select: { id: true, ativo: true },
      });
    } else if (!planejamento.ativo) {
      await this.prisma.client.planejamentos.update({
        where: { id: planejamento.id },
        data: { ativo: true },
      });
    }

    // 6. Estatísticas de agentes com/sem rota (baseado na distribuição canônica)
    const agentesComRota = new Set(distribuicoes.map((d) => d.agente_id)).size;
    const totalAgentesSemRota = Math.max(0, totalAgentes - agentesComRota);

    return {
      planejamentoId: planejamento.id,
      cicloId: cicloAtivo.id,
      totalImoveisElegiveis,
      totalImoveisIncluidos: totalImoveisElegiveis,
      totalAgentesComRota: agentesComRota,
      totalAgentesSemRota,
      mensagem: `Operação inicial gerada com ${totalImoveisElegiveis} imóvel(is) elegível(is) em ${quadraIds.length} quarteirão(s) para ${agentesComRota} agente(s).`,
    };
  }
}
