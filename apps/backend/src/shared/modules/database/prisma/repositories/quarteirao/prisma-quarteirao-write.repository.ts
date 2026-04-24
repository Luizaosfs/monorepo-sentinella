import { DistribuicaoQuarteirao, Quarteirao } from '@modules/quarteirao/entities/quarteirao';
import { QuarteiraoWriteRepository } from '@modules/quarteirao/repositories/quarteirao-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaQuarteiraoMapper } from '../../mappers/prisma-quarteirao.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(QuarteiraoWriteRepository)
@Injectable()
export class PrismaQuarteiraoWriteRepository implements QuarteiraoWriteRepository {
  constructor(private prisma: PrismaService) {}

  async createQuarteirao(entity: Quarteirao): Promise<Quarteirao> {
    const data = {
      cliente_id: entity.clienteId,
      regiao_id: entity.regiaoId || null,
      codigo: entity.codigo,
      bairro: entity.bairro || null,
      ativo: entity.ativo,
    };
    const created = await this.prisma.client.quarteiroes.create({ data });
    return PrismaQuarteiraoMapper.quarteiraoToDomain(created as any);
  }

  async softDeleteQuarteirao(id: string, deletedBy?: string): Promise<void> {
    await this.prisma.client.quarteiroes.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        deleted_by: deletedBy ?? null,
        updated_at: new Date(),
      },
    });
  }

  async createDistribuicao(
    entity: DistribuicaoQuarteirao,
  ): Promise<DistribuicaoQuarteirao> {
    const data = {
      cliente_id: entity.clienteId,
      ciclo: entity.ciclo,
      quarteirao: entity.quarteirao,
      agente_id: entity.agenteId,
      regiao_id: entity.regiaoId || null,
    };
    const created = await this.prisma.client.distribuicao_quarteirao.create({
      data,
    });
    return PrismaQuarteiraoMapper.distribuicaoToDomain(created as any);
  }

  async deleteDistribuicao(id: string): Promise<void> {
    await this.prisma.client.distribuicao_quarteirao.delete({ where: { id } });
  }

  async copiarDistribuicoesCiclo(input: {
    clienteId: string;
    cicloOrigem: number;
    cicloDestino: number;
  }): Promise<{ copiadas: number }> {
    const origens = await this.prisma.client.distribuicao_quarteirao.findMany({
      where: {
        cliente_id: input.clienteId,
        ciclo: input.cicloOrigem,
      },
    });

    let copiadas = 0;
    await this.prisma.client.$transaction(async (tx) => {
      for (const row of origens) {
        await tx.distribuicao_quarteirao.upsert({
          where: {
            cliente_id_ciclo_quarteirao: {
              cliente_id: input.clienteId,
              ciclo: input.cicloDestino,
              quarteirao: row.quarteirao,
            },
          },
          create: {
            cliente_id: input.clienteId,
            ciclo: input.cicloDestino,
            quarteirao: row.quarteirao,
            agente_id: row.agente_id,
            regiao_id: row.regiao_id,
          },
          update: {
            agente_id: row.agente_id,
            regiao_id: row.regiao_id,
            updated_at: new Date(),
          },
        });
        copiadas += 1;
      }
    });

    return { copiadas };
  }

  async upsertMestreIfMissing(
    clienteId: string,
    bairro: string | null | undefined,
    codigo: string,
  ): Promise<void> {
    const exists = await this.prisma.client.quarteiroes.findFirst({
      where: { cliente_id: clienteId, codigo, deleted_at: null },
      select: { id: true },
    });
    if (!exists) {
      await this.prisma.client.quarteiroes.create({
        data: { cliente_id: clienteId, codigo, bairro: bairro ?? null, ativo: true },
      });
    }
  }
}
