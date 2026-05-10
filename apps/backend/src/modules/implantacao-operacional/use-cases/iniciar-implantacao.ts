import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ImplantacaoException } from '../errors/implantacao.exception';

export interface IniciarImplantacaoResult {
  planejamentoId: string;
  criado: boolean;
}

@Injectable()
export class IniciarImplantacao {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<IniciarImplantacaoResult> {
    // Validação 1: ciclo ativo obrigatório
    const cicloAtivo = await this.prisma.client.ciclos.findFirst({
      where: { cliente_id: clienteId, status: 'ativo' },
      select: { id: true, numero: true },
    });
    if (!cicloAtivo) throw ImplantacaoException.semCicloAtivo();

    // Validação 2: ao menos um agente ativo
    const agentes = await this.prisma.client.usuarios.count({
      where: {
        cliente_id: clienteId,
        ativo: true,
        papeis_usuarios: { some: { papel: 'agente' } },
      },
    });
    if (agentes === 0) throw ImplantacaoException.semAgentes();

    // Validação 3: ao menos um quarteirão
    const totalQuarteiroes = await this.prisma.client.bairros_quadras.count({
      where: { cliente_id: clienteId, deleted_at: null },
    });
    if (totalQuarteiroes === 0) throw ImplantacaoException.semQuarteiroes();

    // Validação 4: ao menos um quarteirão distribuído
    const distribuicoes = await this.prisma.client.bairros_distribuicao.count({
      where: { cliente_id: clienteId, ciclo_id: cicloAtivo.id },
    });
    if (distribuicoes === 0) throw ImplantacaoException.semDistribuicao();

    // Criar planejamento inicial MANUAL se não existir
    const existente = await this.prisma.client.planejamentos.findFirst({
      where: { cliente_id: clienteId, tipo_levantamento: 'MANUAL', deleted_at: null },
      select: { id: true },
    });

    if (existente) {
      return { planejamentoId: existente.id, criado: false };
    }

    const criado = await this.prisma.client.planejamentos.create({
      data: {
        cliente_id: clienteId,
        descricao: `Levantamento inicial - Ciclo ${cicloAtivo.numero}`,
        tipo_levantamento: 'MANUAL',
        ativo: true,
        data_planejamento: new Date(),
      },
      select: { id: true },
    });

    return { planejamentoId: criado.id, criado: true };
  }
}
