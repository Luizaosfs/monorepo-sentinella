import { Prisma } from '@prisma/client';

import { Ciclo } from '@modules/ciclo/entities/ciclo';
import {
  CicloWriteRepository,
  FecharCicloData,
} from '@modules/ciclo/repositories/ciclo-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaCicloMapper } from '../../mappers/prisma-ciclo.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(CicloWriteRepository)
@Injectable()
export class PrismaCicloWriteRepository implements CicloWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(ciclo: Ciclo): Promise<Ciclo> {
    const data = PrismaCicloMapper.toPrisma(ciclo);
    const created = await this.prisma.client.ciclos.create({ data });
    return PrismaCicloMapper.toDomain(created as any);
  }

  async save(ciclo: Ciclo): Promise<void> {
    const data = PrismaCicloMapper.toPrisma(ciclo);
    await this.prisma.client.ciclos.update({ where: { id: ciclo.id }, data });
  }

  async desativarTodos(clienteId: string): Promise<void> {
    await this.prisma.client.ciclos.updateMany({
      where: { cliente_id: clienteId, status: 'ativo' },
      data: { status: 'planejamento', updated_at: new Date() },
    });
  }

  async abrirCiclo(entity: Ciclo): Promise<Ciclo> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (this.prisma.client.ciclos.upsert as any)({
      where: {
        cliente_id_numero_ano: {
          cliente_id: entity.clienteId,
          numero: entity.numero,
          ano: entity.ano,
        },
      },
      create: {
        cliente_id: entity.clienteId,
        numero: entity.numero,
        ano: entity.ano,
        status: 'ativo',
        data_inicio: entity.dataInicio,
        data_fim_prevista: entity.dataFimPrevista,
        meta_cobertura_pct: entity.metaCoberturaPct ?? 100,
        observacao_abertura: entity.observacaoAbertura ?? null,
        aberto_por: entity.abertoPor ?? null,
      },
      update: {
        status: 'ativo',
        aberto_por: entity.abertoPor ?? null,
        observacao_abertura: entity.observacaoAbertura ?? null,
        updated_at: new Date(),
      },
    });
    return PrismaCicloMapper.toDomain(result as any);
  }

  async fecharCiclo(
    id: string,
    data: FecharCicloData,
  ): Promise<{ snapshot: Record<string, unknown> }> {
    const ciclo = await this.prisma.client.ciclos.findUnique({ where: { id } });

    const [totalFocos, totalVistorias, totalImoveis] = await Promise.all([
      this.prisma.client.focos_risco.count({
        where: { cliente_id: ciclo!.cliente_id },
      }),
      this.prisma.client.vistorias.count({
        where: { cliente_id: ciclo!.cliente_id, ciclo: ciclo!.numero },
      }),
      this.prisma.client.imoveis.count({
        where: { cliente_id: ciclo!.cliente_id },
      }),
    ]);

    const snapshot: Record<string, unknown> = {
      total_focos: totalFocos,
      total_vistorias: totalVistorias,
      total_imoveis: totalImoveis,
    };

    await this.prisma.client.ciclos.update({
      where: { id },
      data: {
        status: 'fechado',
        data_fechamento: data.dataFechamento,
        snapshot_fechamento: snapshot as Prisma.InputJsonValue,
        fechado_por: data.fechadoPor,
        observacao_fechamento: data.observacaoFechamento ?? null,
        updated_at: new Date(),
      },
    });

    return { snapshot };
  }
}
