import { Injectable } from '@nestjs/common';
import {
  BillingCiclo,
  ClientePlano,
  ClienteQuotas,
  Plano,
} from 'src/modules/billing/entities/billing';
import {
  BillingReadRepository,
  UsoMensal,
} from 'src/modules/billing/repositories/billing-read.repository';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaBillingMapper } from '../../mappers/prisma-billing.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(BillingReadRepository)
@Injectable()
export class PrismaBillingReadRepository implements BillingReadRepository {
  constructor(private prisma: PrismaService) {}

  async findPlanos(): Promise<Plano[]> {
    const rows = await this.prisma.client.planos.findMany({
      orderBy: { ordem: 'asc' },
    });
    return rows.map(PrismaBillingMapper.planoToDomain);
  }

  async findPlanoById(id: string): Promise<Plano | null> {
    const row = await this.prisma.client.planos.findUnique({ where: { id } });
    return row ? PrismaBillingMapper.planoToDomain(row) : null;
  }

  async findClientePlano(clienteId: string): Promise<ClientePlano | null> {
    const row = await this.prisma.client.cliente_plano.findFirst({
      where: { cliente_id: clienteId, status: 'ativo' },
      orderBy: { created_at: 'desc' },
    });
    return row ? PrismaBillingMapper.clientePlanToDomain(row) : null;
  }

  async findCiclos(clienteId: string): Promise<BillingCiclo[]> {
    const rows = await this.prisma.client.billing_ciclo.findMany({
      where: { cliente_id: clienteId },
      orderBy: { periodo_inicio: 'desc' },
    });
    return rows.map(PrismaBillingMapper.cicleToDomain);
  }

  async findCicloById(id: string): Promise<BillingCiclo | null> {
    const row = await this.prisma.client.billing_ciclo.findUnique({
      where: { id },
    });
    return row ? PrismaBillingMapper.cicleToDomain(row) : null;
  }

  async findQuotas(clienteId: string): Promise<ClienteQuotas | null> {
    const row = await this.prisma.client.cliente_quotas.findFirst({
      where: { cliente_id: clienteId },
    });
    return row ? PrismaBillingMapper.quotasToDomain(row) : null;
  }

  async findUsoMensal(
    clienteId: string,
    mesInicio: Date,
    mesFim: Date,
  ): Promise<UsoMensal> {
    const periodoWhere = { gte: mesInicio, lte: mesFim };

    const [voosMes, levantamentosMes, itensMes, usuariosAtivos] =
      await this.prisma.client.$transaction([
        // voos não tem cliente_id nem deleted_at direto — join via planejamento
        this.prisma.client.voos.count({
          where: {
            planejamento: { cliente_id: clienteId, deleted_at: null },
            inicio: periodoWhere,
          },
        }),
        this.prisma.client.levantamentos.count({
          where: {
            cliente_id: clienteId,
            created_at: periodoWhere,
            deleted_at: null,
          },
        }),
        this.prisma.client.levantamento_itens.count({
          where: {
            cliente_id: clienteId,
            created_at: periodoWhere,
            deleted_at: null,
          },
        }),
        // usuarios não tem deleted_at — soft delete via ativo: false
        this.prisma.client.usuarios.count({
          where: {
            cliente_id: clienteId,
            ativo: true,
          },
        }),
      ]);

    return { clienteId, voosMes, levantamentosMes, itensMes, usuariosAtivos };
  }

  async findUsoMensalTodos(
    mesInicio: Date,
    mesFim: Date,
  ): Promise<UsoMensal[]> {
    const clientes = await this.prisma.client.clientes.findMany({
      where: { deleted_at: null },
      select: { id: true },
    });

    return Promise.all(
      clientes.map((c) => this.findUsoMensal(c.id, mesInicio, mesFim)),
    );
  }
}
