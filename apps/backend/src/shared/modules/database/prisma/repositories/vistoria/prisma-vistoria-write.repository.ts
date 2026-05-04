import {
  Vistoria,
  VistoriaCalha,
  VistoriaDeposito,
  VistoriaRisco,
  VistoriaSintoma,
} from '@modules/vistoria/entities/vistoria';
import {
  ArquivamentoAnterior,
  ConsolidacaoDados,
  CreateCompletaSubItems,
  VistoriaWriteRepository,
} from '@modules/vistoria/repositories/vistoria-write.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaVistoriaMapper } from '../../mappers/prisma-vistoria.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(VistoriaWriteRepository)
@Injectable()
export class PrismaVistoriaWriteRepository implements VistoriaWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(entity: Vistoria): Promise<Vistoria> {
    const raw = await this.prisma.client.vistorias.create({
      data: PrismaVistoriaMapper.toPrisma(entity),
    });
    return PrismaVistoriaMapper.toDomain(raw as any);
  }

  async save(entity: Vistoria): Promise<void> {
    await this.prisma.client.vistorias.update({
      where: { id: entity.id },
      data: PrismaVistoriaMapper.toPrisma(entity),
    });
  }

  async createDeposito(
    deposito: VistoriaDeposito & { vistoriaId: string; clienteId: string },
  ): Promise<VistoriaDeposito> {
    const raw = await this.prisma.client.vistoria_depositos.create({
      data: PrismaVistoriaMapper.depositoToPrisma(deposito),
    });
    return PrismaVistoriaMapper.depositoToDomain(raw as any);
  }

  async createSintoma(
    sintoma: VistoriaSintoma & { vistoriaId: string; clienteId: string },
  ): Promise<VistoriaSintoma> {
    const raw = await this.prisma.client.vistoria_sintomas.create({
      data: PrismaVistoriaMapper.sintomaToPrisma(sintoma),
    });
    return PrismaVistoriaMapper.sintomaToDomain(raw as any);
  }

  async createRisco(
    risco: VistoriaRisco & { vistoriaId: string; clienteId: string },
  ): Promise<VistoriaRisco> {
    const raw = await this.prisma.client.vistoria_riscos.create({
      data: PrismaVistoriaMapper.riscoToPrisma(risco),
    });
    return PrismaVistoriaMapper.riscoToDomain(raw as any);
  }

  async createCalha(
    calha: VistoriaCalha & { vistoriaId: string; clienteId: string },
  ): Promise<VistoriaCalha> {
    const raw = await this.prisma.client.vistoria_calhas.create({
      data: PrismaVistoriaMapper.calhaToPrisma(calha),
    });
    return PrismaVistoriaMapper.calhaToDomain(raw as any);
  }

  async createCompleta(
    entity: Vistoria,
    subItems: CreateCompletaSubItems,
    idempotencyKey?: string,
  ): Promise<string> {
    if (idempotencyKey) {
      const existing = await this.prisma.client.vistorias.findFirst({
        where: { idempotency_key: idempotencyKey, deleted_at: null },
        select: { id: true },
      });
      if (existing) return existing.id;
    }

    return await this.prisma.client.$transaction(async (tx) => {
      const raw = await tx.vistorias.create({
        data: {
          ...PrismaVistoriaMapper.toPrisma(entity),
          ...(idempotencyKey && { idempotency_key: idempotencyKey }),
        },
      });

      const clienteId = raw.cliente_id;

      if (subItems.depositos?.length) {
        await tx.vistoria_depositos.createMany({
          data: subItems.depositos.map((d) =>
            PrismaVistoriaMapper.depositoToPrisma({ ...d, vistoriaId: raw.id, clienteId }),
          ),
        });
      }

      if (subItems.sintomas?.length) {
        await tx.vistoria_sintomas.createMany({
          data: subItems.sintomas.map((s) =>
            PrismaVistoriaMapper.sintomaToPrisma({ ...s, vistoriaId: raw.id, clienteId }),
          ),
        });
      }

      if (subItems.riscos?.length) {
        await tx.vistoria_riscos.createMany({
          data: subItems.riscos.map((r) =>
            PrismaVistoriaMapper.riscoToPrisma({ ...r, vistoriaId: raw.id, clienteId }),
          ),
        });
      }

      if (subItems.calhas?.length) {
        await tx.vistoria_calhas.createMany({
          data: subItems.calhas.map((c) =>
            PrismaVistoriaMapper.calhaToPrisma({ ...c, vistoriaId: raw.id, clienteId }),
          ),
        });
      }

      const allEvidencias = (subItems.depositos ?? []).flatMap((d) =>
        (d.evidencias ?? []).map((e) => ({
          cliente_id: clienteId,
          vistoria_id: raw.id,
          tipo_deposito: d.tipoDeposito,
          tipo_imagem: e.tipoImagem,
          url_original: e.urlOriginal,
          url_thumbnail: e.urlThumbnail ?? null,
          public_id: e.publicId,
          tamanho_bytes: e.tamanhoBytes ?? null,
          mime_type: e.mimeType ?? null,
          capturada_em: e.capturadaEm ?? null,
          status_upload: e.statusUpload ?? 'enviado',
        })),
      );

      if (allEvidencias.length) {
        await tx.vistoria_deposito_evidencias.createMany({ data: allEvidencias });
      }

      return raw.id;
    });
  }

  async salvarConsolidacao(
    vistoriaId: string,
    dados: ConsolidacaoDados,
    arquivar?: ArquivamentoAnterior,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.client.$transaction(async (tx) => {
      if (arquivar) {
        await tx.vistoria_consolidacao_historico.create({
          data: {
            vistoria_id: vistoriaId,
            prioridade_final: arquivar.prioridadeFinal ?? null,
            dimensao_dominante: arquivar.dimensaoDominante ?? null,
            consolidacao_json:
              arquivar.consolidacaoJson != null
                ? (arquivar.consolidacaoJson as Prisma.InputJsonValue)
                : Prisma.DbNull,
            versao_regra: arquivar.versaoRegra ?? null,
            versao_pesos: arquivar.versaoPesos ?? null,
            consolidado_em: arquivar.consolidadoEm,
            motivo_reprocessamento: arquivar.motivo,
            reprocessado_por: arquivar.reprocessadoPor ?? null,
          },
        });
      }

      await tx.vistorias.update({
        where: { id: vistoriaId },
        data: {
          resultado_operacional: dados.resultadoOperacional,
          vulnerabilidade_domiciliar: dados.vulnerabilidadeDomiciliar,
          alerta_saude: dados.alertaSaude,
          risco_socioambiental: dados.riscoSocioambiental,
          risco_vetorial: dados.riscoVetorial,
          prioridade_final: dados.prioridadeFinal,
          prioridade_motivo: dados.prioridadeMotivo,
          dimensao_dominante: dados.dimensaoDominante ?? null,
          consolidacao_resumo: dados.consolidacaoResumo,
          consolidacao_json: dados.consolidacaoJson as Prisma.InputJsonValue,
          consolidacao_incompleta: dados.consolidacaoIncompleta,
          versao_regra_consolidacao: dados.versaoRegraConsolidacao,
          versao_pesos_consolidacao: dados.versaoPesosConsolidacao,
          consolidado_em: now,
          ...(arquivar && {
            reprocessado_em: now,
            reprocessado_por: arquivar.reprocessadoPor ?? null,
          }),
        },
      });
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.vistorias.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
