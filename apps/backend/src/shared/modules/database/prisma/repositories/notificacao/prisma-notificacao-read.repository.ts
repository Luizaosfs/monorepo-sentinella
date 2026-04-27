import { Injectable } from '@nestjs/common';
import {
  CasoNotificado,
  ItemNotificacaoEsus,
  PushSubscription,
  UnidadeSaude,
} from 'src/modules/notificacao/entities/notificacao';
import {
  CasosPaginados,
  NotificacaoReadRepository,
} from 'src/modules/notificacao/repositories/notificacao-read.repository';
import { Prisma } from '@prisma/client';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaNotificacaoMapper } from '../../mappers/prisma-notificacao.mapper';
import { PrismaService } from '../../prisma.service';


@PrismaRepository(NotificacaoReadRepository)
@Injectable()
export class PrismaNotificacaoReadRepository implements NotificacaoReadRepository {
  constructor(private prisma: PrismaService) {}

  async findUnidades(clienteId: string): Promise<UnidadeSaude[]> {
    const rows = await this.prisma.client.unidades_saude.findMany({
      where: { cliente_id: clienteId, deleted_at: null },
      orderBy: { nome: 'asc' },
    });
    return rows.map(PrismaNotificacaoMapper.unidadeToDomain);
  }

  async findUnidadeById(id: string, clienteId: string | null): Promise<UnidadeSaude | null> {
    const row = await this.prisma.client.unidades_saude.findFirst({
      where: { id, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return row ? PrismaNotificacaoMapper.unidadeToDomain(row) : null;
  }

  async findCasos(
    clienteId: string,
    filters?: { status?: string; regiaoId?: string },
  ): Promise<CasoNotificado[]> {
    const rows = await this.prisma.client.casos_notificados.findMany({
      where: {
        cliente_id: clienteId,
        deleted_at: null,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.regiaoId ? { regiao_id: filters.regiaoId } : {}),
      },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(PrismaNotificacaoMapper.casoToDomain);
  }

  async findCasoById(id: string, clienteId: string | null): Promise<CasoNotificado | null> {
    const row = await this.prisma.client.casos_notificados.findFirst({
      where: { id, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return row ? PrismaNotificacaoMapper.casoToDomain(row) : null;
  }

  async findPushByUsuario(usuarioId: string): Promise<PushSubscription[]> {
    const rows = await this.prisma.client.push_subscriptions.findMany({
      where: { usuario_id: usuarioId },
    });
    return rows.map(PrismaNotificacaoMapper.pushToDomain);
  }

  async findEsus(clienteId: string): Promise<ItemNotificacaoEsus[]> {
    const rows = await this.prisma.client.item_notificacoes_esus.findMany({
      where: { cliente_id: clienteId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(PrismaNotificacaoMapper.esusToDomain);
  }

  async findEsusById(id: string, clienteId: string | null): Promise<ItemNotificacaoEsus | null> {
    const row = await this.prisma.client.item_notificacoes_esus.findFirst({
      where: { id, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return row ? PrismaNotificacaoMapper.esusToDomain(row) : null;
  }

  async findCasosPaginated(
    clienteId: string,
    limit: number,
    cursor?: string,
  ): Promise<CasosPaginados> {
    let cursorDate: Date | undefined;
    let cursorId: string | undefined;

    if (cursor) {
      const [iso, id] = cursor.split('|');
      cursorDate = new Date(iso);
      cursorId = id;
    }

    const rows = await this.prisma.client.casos_notificados.findMany({
      where: {
        cliente_id: clienteId,
        deleted_at: null,
        ...(cursorDate && cursorId
          ? {
              OR: [
                { created_at: { lt: cursorDate } },
                { created_at: cursorDate, id: { gt: cursorId } },
              ],
            }
          : {}),
      },
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? `${last.created_at.toISOString()}|${last.id}`
        : null;

    return {
      items: items.map(PrismaNotificacaoMapper.casoToDomain),
      nextCursor,
    };
  }

  async findCasosNoRaio(
    lat: number,
    lng: number,
    raioMetros: number,
    clienteId: string,
  ): Promise<CasoNotificado[]> {
    const rows = await this.prisma.client.$queryRaw<any[]>`
      SELECT *
      FROM casos_notificados
      WHERE cliente_id = ${clienteId}::uuid
        AND deleted_at IS NULL
        AND sqrt(
              power((latitude  - ${lat})  * 111320, 2) +
              power((longitude - ${lng}) * 111320 * cos(radians(${lat})), 2)
            ) <= ${raioMetros}
      ORDER BY created_at DESC
    `;
    return rows.map(PrismaNotificacaoMapper.casoToDomain);
  }
}
