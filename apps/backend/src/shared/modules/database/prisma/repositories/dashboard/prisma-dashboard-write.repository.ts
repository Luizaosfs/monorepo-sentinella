import { Injectable } from '@nestjs/common';
import { RelatorioGerado } from 'src/modules/dashboard/entities/dashboard';
import { DashboardWriteRepository } from 'src/modules/dashboard/repositories/dashboard-write.repository';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaDashboardMapper } from '../../mappers/prisma-dashboard.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(DashboardWriteRepository)
@Injectable()
export class PrismaDashboardWriteRepository implements DashboardWriteRepository {
  constructor(private prisma: PrismaService) {}

  async createRelatorio(entity: RelatorioGerado): Promise<RelatorioGerado> {
    const row = await this.prisma.client.relatorios_gerados.create({
      data: PrismaDashboardMapper.relatorioToPrisma(entity),
    });
    return PrismaDashboardMapper.relatorioToDomain(row);
  }

  async resolverAlert(id: string): Promise<void> {
    await this.prisma.client.system_alerts.update({
      where: { id },
      data: { resolvido: true, resolvido_em: new Date() },
    });
  }
}
