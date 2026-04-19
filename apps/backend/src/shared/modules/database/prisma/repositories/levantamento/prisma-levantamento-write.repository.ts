import {
  Levantamento,
  LevantamentoItem,
} from '@modules/levantamento/entities/levantamento';
import {
  CriarItemManualParams,
  CriarLevantamentoManualParams,
  ItemManualResult,
  LevantamentoWriteRepository,
} from '@modules/levantamento/repositories/levantamento-write.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaLevantamentoMapper } from '../../mappers/prisma-levantamento.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(LevantamentoWriteRepository)
@Injectable()
export class PrismaLevantamentoWriteRepository implements LevantamentoWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(levantamento: Levantamento): Promise<Levantamento> {
    const data = PrismaLevantamentoMapper.toPrisma(levantamento);
    const created = await this.prisma.client.levantamentos.create({ data });
    return PrismaLevantamentoMapper.toDomain(created as any);
  }

  async save(levantamento: Levantamento): Promise<void> {
    const data = PrismaLevantamentoMapper.toPrisma(levantamento);
    await this.prisma.client.levantamentos.updateMany({
      where: { id: levantamento.id, cliente_id: levantamento.clienteId },
      data,
    });
  }

  async createItem(item: LevantamentoItem): Promise<LevantamentoItem> {
    const data = PrismaLevantamentoMapper.itemToPrisma(item);
    const created = await this.prisma.client.levantamento_itens.create({
      data,
    });
    return PrismaLevantamentoMapper.itemToDomain(created as any);
  }

  async createLevantamentoManual(
    params: CriarLevantamentoManualParams,
  ): Promise<{ id: string }> {
    const result = await this.prisma.client.levantamentos.create({
      data: {
        cliente_id: params.clienteId,
        usuario_id: params.usuarioId,
        planejamento_id: params.planejamentoId,
        tipo_entrada: params.tipoEntrada,
        data_voo: params.dataVoo,
        status_processamento: 'aguardando',
        total_itens: 0,
      },
      select: { id: true },
    });
    return { id: result.id };
  }

  async criarItemManual(params: CriarItemManualParams): Promise<ItemManualResult> {
    const result = await this.prisma.client.levantamento_itens.create({
      data: {
        levantamento_id: params.levantamentoId,
        cliente_id: params.clienteId ?? null,
        latitude: params.latitude ?? null,
        longitude: params.longitude ?? null,
        item: params.item ?? null,
        risco: params.risco ?? null,
        acao: params.acao ?? null,
        score_final: params.scoreFinal ?? null,
        prioridade: params.prioridade ?? null,
        sla_horas: params.slaHoras ?? null,
        endereco_curto: params.enderecoCurto ?? null,
        endereco_completo: params.enderecoCompleto ?? null,
        image_url: params.imageUrl ?? null,
        maps: params.maps ?? null,
        waze: params.waze ?? null,
        data_hora: params.dataHora ?? null,
        peso: params.peso ?? null,
        payload: params.payload ? (params.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
        image_public_id: params.imagePublicId ?? null,
      },
      select: {
        id: true,
        levantamento_id: true,
        cliente_id: true,
        latitude: true,
        longitude: true,
        item: true,
        risco: true,
        acao: true,
        score_final: true,
        prioridade: true,
        sla_horas: true,
        endereco_curto: true,
        endereco_completo: true,
        image_url: true,
        maps: true,
        waze: true,
        data_hora: true,
        peso: true,
        payload: true,
        image_public_id: true,
        created_at: true,
      },
    });
    return {
      id: result.id,
      levantamentoId: result.levantamento_id,
      clienteId: result.cliente_id ?? undefined,
      latitude: result.latitude ?? undefined,
      longitude: result.longitude ?? undefined,
      item: result.item ?? undefined,
      risco: result.risco ?? undefined,
      acao: result.acao ?? undefined,
      scoreFinal: result.score_final ?? undefined,
      prioridade: result.prioridade ?? undefined,
      slaHoras: result.sla_horas ?? undefined,
      enderecoCurto: result.endereco_curto ?? undefined,
      enderecoCompleto: result.endereco_completo ?? undefined,
      imageUrl: result.image_url ?? undefined,
      maps: result.maps ?? undefined,
      waze: result.waze ?? undefined,
      dataHora: result.data_hora ?? undefined,
      peso: result.peso ?? undefined,
      payload: result.payload ? (result.payload as Record<string, unknown>) : undefined,
      imagePublicId: result.image_public_id ?? undefined,
      createdAt: result.created_at,
    };
  }

  async incrementTotalItens(levantamentoId: string): Promise<void> {
    await this.prisma.client.levantamentos.update({
      where: { id: levantamentoId },
      data: {
        total_itens: { increment: 1 },
        updated_at: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.client.levantamentos.delete({ where: { id } });
  }

  async updateItem(id: string, data: Parameters<LevantamentoWriteRepository['updateItem']>[1]): Promise<void> {
    await this.prisma.client.levantamento_itens.update({
      where: { id },
      data: {
        ...(data.item !== undefined && { item: data.item }),
        ...(data.risco !== undefined && { risco: data.risco }),
        ...(data.acao !== undefined && { acao: data.acao }),
        ...(data.prioridade !== undefined && { prioridade: data.prioridade }),
        ...(data.slaHoras !== undefined && { sla_horas: data.slaHoras }),
        ...(data.enderecoCurto !== undefined && { endereco_curto: data.enderecoCurto }),
        ...(data.enderecoCompleto !== undefined && { endereco_completo: data.enderecoCompleto }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.maps !== undefined && { maps: data.maps }),
        ...(data.waze !== undefined && { waze: data.waze }),
        ...(data.imageUrl !== undefined && { image_url: data.imageUrl }),
        ...(data.imagePublicId !== undefined && { image_public_id: data.imagePublicId }),
        ...(data.scoreFinal !== undefined && { score_final: data.scoreFinal }),
        ...(data.peso !== undefined && { peso: data.peso }),
        updated_at: new Date(),
      },
    });
  }

  async deleteItem(id: string): Promise<void> {
    await this.prisma.client.levantamento_itens.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async addItemEvidencia(itemId: string, data: { url: string; publicId?: string; tipo?: string }) {
    const raw = await this.prisma.client.levantamento_item_evidencias.create({
      data: {
        item_id: itemId,
        url: data.url,
        public_id: data.publicId ?? null,
        tipo: data.tipo ?? null,
      },
    });
    return PrismaLevantamentoMapper.evidenciaToDomain(raw as any);
  }

  async criarItemTags(itemId: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.prisma.client.$executeRaw(
        Prisma.sql`INSERT INTO levantamento_item_tags (levantamento_item_id, tag)
                   VALUES (${itemId}::uuid, ${tag})
                   ON CONFLICT DO NOTHING`,
      );
    }
  }
}
