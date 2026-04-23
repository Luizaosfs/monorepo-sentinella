import { Imovel } from '@modules/imovel/entities/imovel';
import {
  ImovelWriteRepository,
  UpsertScoreData,
} from '@modules/imovel/repositories/imovel-write.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaImovelMapper } from '../../mappers/prisma-imovel.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(ImovelWriteRepository)
@Injectable()
export class PrismaImovelWriteRepository implements ImovelWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(imovel: Imovel): Promise<Imovel> {
    const data = PrismaImovelMapper.toPrisma(imovel);
    const created = await this.prisma.client.imoveis.create({ data });
    return PrismaImovelMapper.toDomain(created as any);
  }

  async save(imovel: Imovel): Promise<void> {
    const data = PrismaImovelMapper.toPrisma(imovel);
    await this.prisma.client.imoveis.updateMany({ where: { id: imovel.id, cliente_id: imovel.clienteId }, data });
  }

  async softDelete(id: string, deletedBy: string, clienteId: string): Promise<void> {
    await this.prisma.client.imoveis.updateMany({
      where: { id, cliente_id: clienteId },
      data: { deleted_at: new Date(), deleted_by: deletedBy },
    });
  }

  async seedScoreConfigIfMissing(clienteId: string): Promise<void> {
    await this.prisma.client.$executeRaw`
      INSERT INTO score_config (cliente_id)
      VALUES (${clienteId}::uuid)
      ON CONFLICT (cliente_id) DO NOTHING
    `;
  }

  async upsertScore(data: UpsertScoreData): Promise<void> {
    const now = new Date();
    await this.prisma.client.territorio_score.upsert({
      where: {
        cliente_id_imovel_id: { cliente_id: data.clienteId, imovel_id: data.imovelId },
      },
      update: {
        score: data.score,
        classificacao: data.classificacao,
        fatores: data.fatores as Prisma.InputJsonValue,
        calculado_em: now,
        updated_at: now,
      },
      create: {
        cliente_id: data.clienteId,
        imovel_id: data.imovelId,
        score: data.score,
        classificacao: data.classificacao,
        fatores: data.fatores as Prisma.InputJsonValue,
        calculado_em: now,
      },
    });
  }
}
