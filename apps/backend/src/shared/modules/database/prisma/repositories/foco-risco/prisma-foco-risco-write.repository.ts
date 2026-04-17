import {
  FocoRisco,
  FocoRiscoHistorico,
} from '@modules/foco-risco/entities/foco-risco';
import { FocoRiscoWriteRepository } from '@modules/foco-risco/repositories/foco-risco-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaFocoRiscoMapper } from '../../mappers/prisma-foco-risco.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(FocoRiscoWriteRepository)
@Injectable()
export class PrismaFocoRiscoWriteRepository implements FocoRiscoWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(foco: FocoRisco): Promise<FocoRisco> {
    const data = PrismaFocoRiscoMapper.toPrisma(foco);
    const created = await this.prisma.client.focos_risco.create({ data });
    return PrismaFocoRiscoMapper.toDomain(created);
  }

  async save(foco: FocoRisco): Promise<void> {
    const data = PrismaFocoRiscoMapper.toPrisma(foco);
    await this.prisma.client.focos_risco.update({
      where: { id: foco.id },
      data,
    });
  }

  async createHistorico(
    historico: FocoRiscoHistorico,
  ): Promise<FocoRiscoHistorico> {
    const data = PrismaFocoRiscoMapper.historicToPrisma(historico);
    const created = await this.prisma.client.foco_risco_historico.create({ data });
    return PrismaFocoRiscoMapper.historicToDomain(created);
  }
}
