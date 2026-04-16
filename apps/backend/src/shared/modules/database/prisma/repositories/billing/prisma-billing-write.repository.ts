import { Injectable } from '@nestjs/common';
import {
  BillingCiclo,
  ClientePlano,
  ClienteQuotas,
  Plano,
} from 'src/modules/billing/entities/billing';
import { BillingWriteRepository } from 'src/modules/billing/repositories/billing-write.repository';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaBillingMapper } from '../../mappers/prisma-billing.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(BillingWriteRepository)
@Injectable()
export class PrismaBillingWriteRepository implements BillingWriteRepository {
  constructor(private prisma: PrismaService) {}

  async createPlano(entity: Plano): Promise<Plano> {
    const row = await this.prisma.client.planos.create({
      data: PrismaBillingMapper.planoToPrisma(entity),
    });
    return PrismaBillingMapper.planoToDomain(row);
  }

  async savePlano(entity: Plano): Promise<void> {
    await this.prisma.client.planos.update({
      where: { id: entity.id },
      data: PrismaBillingMapper.planoToPrisma(entity),
    });
  }

  async createClientePlano(entity: ClientePlano): Promise<ClientePlano> {
    const row = await this.prisma.client.cliente_plano.create({
      data: PrismaBillingMapper.clientePlanToPrisma(entity) as any,
    });
    return PrismaBillingMapper.clientePlanToDomain(row);
  }

  async saveClientePlano(entity: ClientePlano): Promise<void> {
    await this.prisma.client.cliente_plano.update({
      where: { id: entity.id },
      data: {
        ...PrismaBillingMapper.clientePlanToPrisma(entity),
        updated_at: new Date(),
      } as any,
    });
  }

  async createCiclo(entity: BillingCiclo): Promise<BillingCiclo> {
    const row = await this.prisma.client.billing_ciclo.create({
      data: PrismaBillingMapper.cicleToPrisma(entity),
    });
    return PrismaBillingMapper.cicleToDomain(row);
  }

  async saveCiclo(entity: BillingCiclo): Promise<void> {
    await this.prisma.client.billing_ciclo.update({
      where: { id: entity.id },
      data: {
        ...PrismaBillingMapper.cicleToPrisma(entity),
        updated_at: new Date(),
      },
    });
  }

  async upsertQuotas(entity: ClienteQuotas): Promise<ClienteQuotas> {
    const existing = await this.prisma.client.cliente_quotas.findFirst({
      where: { cliente_id: entity.clienteId },
    });
    if (existing) {
      const row = await this.prisma.client.cliente_quotas.update({
        where: { id: existing.id },
        data: {
          ...PrismaBillingMapper.quotasToPrisma(entity),
          updated_at: new Date(),
        },
      });
      return PrismaBillingMapper.quotasToDomain(row);
    }
    const row = await this.prisma.client.cliente_quotas.create({
      data: PrismaBillingMapper.quotasToPrisma(entity),
    });
    return PrismaBillingMapper.quotasToDomain(row);
  }
}
