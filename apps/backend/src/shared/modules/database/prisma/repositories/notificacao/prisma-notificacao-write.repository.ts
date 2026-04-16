import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CasoNotificado,
  ItemNotificacaoEsus,
  PushSubscription,
  UnidadeSaude,
} from 'src/modules/notificacao/entities/notificacao';
import { NotificacaoWriteRepository } from 'src/modules/notificacao/repositories/notificacao-write.repository';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaNotificacaoMapper } from '../../mappers/prisma-notificacao.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(NotificacaoWriteRepository)
@Injectable()
export class PrismaNotificacaoWriteRepository implements NotificacaoWriteRepository {
  constructor(private prisma: PrismaService) {}

  async createUnidade(entity: UnidadeSaude): Promise<UnidadeSaude> {
    const row = await this.prisma.client.unidades_saude.create({
      data: PrismaNotificacaoMapper.unidadeToPrisma(entity),
    });
    return PrismaNotificacaoMapper.unidadeToDomain(row);
  }

  async saveUnidade(entity: UnidadeSaude): Promise<void> {
    await this.prisma.client.unidades_saude.update({
      where: { id: entity.id },
      data: {
        ...PrismaNotificacaoMapper.unidadeToPrisma(entity),
        updated_at: new Date(),
      },
    });
  }

  async deleteUnidade(id: string): Promise<void> {
    await this.prisma.client.unidades_saude.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async createCaso(entity: CasoNotificado): Promise<CasoNotificado> {
    const row = await this.prisma.client.casos_notificados.create({
      data: PrismaNotificacaoMapper.casoToPrisma(entity) as any,
    });
    return PrismaNotificacaoMapper.casoToDomain(row);
  }

  async saveCaso(entity: CasoNotificado): Promise<void> {
    await this.prisma.client.casos_notificados.update({
      where: { id: entity.id },
      data: {
        ...PrismaNotificacaoMapper.casoToPrisma(entity),
        updated_at: new Date(),
      } as any,
    });
  }

  async deleteCaso(id: string): Promise<void> {
    await this.prisma.client.casos_notificados.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async createPush(entity: PushSubscription): Promise<PushSubscription> {
    const row = await this.prisma.client.push_subscriptions.create({
      data: {
        usuario_id: entity.usuarioId,
        cliente_id: entity.clienteId,
        endpoint: entity.endpoint,
        p256dh: entity.p256dh,
        auth: entity.auth,
      },
    });
    return PrismaNotificacaoMapper.pushToDomain(row);
  }

  async deletePush(id: string): Promise<void> {
    await this.prisma.client.push_subscriptions.delete({
      where: { id },
    });
  }

  async createEsus(entity: ItemNotificacaoEsus): Promise<ItemNotificacaoEsus> {
    const row = await this.prisma.client.item_notificacoes_esus.create({
      data: {
        cliente_id: entity.clienteId,
        levantamento_item_id: entity.levantamentoItemId ?? null,
        tipo_agravo: entity.tipoAgravo,
        numero_notificacao: entity.numeroNotificacao ?? null,
        status: entity.status,
        payload_enviado:
          entity.payloadEnviado == null
            ? Prisma.JsonNull
            : (entity.payloadEnviado as Prisma.InputJsonValue),
        enviado_por: entity.enviadoPor ?? null,
      },
    });
    return PrismaNotificacaoMapper.esusToDomain(row);
  }

  async nextProtocolo(clienteId: string): Promise<string> {
    const anoMes = new Date()
      .toISOString()
      .slice(0, 7)
      .replace('-', '');

    const result = await this.prisma.client.$queryRaw<[{ ultimo_seq: bigint }]>`
      INSERT INTO notificacao_protocolo_seq (cliente_id, ano_mes, ultimo_seq)
      VALUES (${clienteId}::uuid, ${anoMes}, 1)
      ON CONFLICT (cliente_id, ano_mes)
      DO UPDATE SET ultimo_seq = notificacao_protocolo_seq.ultimo_seq + 1
      RETURNING ultimo_seq
    `;

    const seq = Number(result[0].ultimo_seq);
    return `${anoMes}-${String(seq).padStart(4, '0')}`;
  }
}
