import { Inject, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { CriarFocoDeLevantamentoItem } from '@/modules/foco-risco/use-cases/auto-criacao/criar-foco-de-levantamento-item';
import { QuotaException } from '../../billing/errors/quota.exception';
import { VerificarQuota } from '../../billing/use-cases/verificar-quota';

import { CriarItemManualBody } from '../dtos/criar-item-manual.body';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class CriarItemManual {
  private readonly logger = new Logger(CriarItemManual.name);

  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
    private criarFocoDeLevantamentoItem: CriarFocoDeLevantamentoItem,
    @Inject('REQUEST') private req: Request,
    private verificarQuota: VerificarQuota,
  ) {}

  async execute(input: CriarItemManualBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const usuarioId = this.req['user']?.id as string;

    // 1. Valida planejamento
    const planejamento = await this.readRepository.findPlanejamento(
      input.planejamentoId,
    );
    if (!planejamento) throw LevantamentoException.planejamentoNotFound();
    if (!planejamento.ativo) throw LevantamentoException.planejamentoInativo();

    // Fase I — enforcement de quota
    const { ok, usado, limite, motivo } = await this.verificarQuota.execute(clienteId, { metrica: 'itens_mes' });
    if (!ok) throw QuotaException.excedida({ metrica: 'itens_mes', usado, limite, motivo });

    const tipoEntrada = planejamento.tipoEntrada ?? 'manual';

    // 2. Busca ou cria levantamento para (cliente, planejamento, dataVoo, tipoEntrada)
    let levantamentoCriado = false;
    let levantamentoId: string;

    const existing = await this.readRepository.findByPlanejamentoDataTipo(
      clienteId,
      input.planejamentoId,
      input.dataVoo,
      tipoEntrada,
    );

    if (existing) {
      levantamentoId = existing.id!;
    } else {
      const created = await this.writeRepository.createLevantamentoManual({
        clienteId,
        usuarioId,
        planejamentoId: input.planejamentoId,
        tipoEntrada,
        dataVoo: input.dataVoo,
      });
      levantamentoId = created.id;
      levantamentoCriado = true;
    }

    // 3. Resolve sla_horas: usa o informado ou calcula de sla_config
    let slaHoras = input.slaHoras;
    if (slaHoras === undefined) {
      const slaConfig = await this.readRepository.findSlaConfig(clienteId);
      if (slaConfig) {
        const cfg = slaConfig.config;
        slaHoras =
          (cfg['sla_horas'] as number | undefined) ??
          (cfg['prazo_horas'] as number | undefined);
      }
    }

    // 4. Cria levantamento_item
    const levantamentoItem = await this.writeRepository.criarItemManual({
      levantamentoId,
      clienteId,
      latitude: input.latitude,
      longitude: input.longitude,
      item: input.item,
      risco: input.risco,
      acao: input.acao,
      scoreFinal: input.scoreFinal,
      prioridade: input.prioridade,
      slaHoras,
      enderecoCurto: input.enderecoCurto,
      enderecoCompleto: input.enderecoCompleto,
      imageUrl: input.imageUrl,
      maps: input.maps,
      waze: input.waze,
      dataHora: input.dataHora,
      peso: input.peso,
      payload: input.payload,
      imagePublicId: input.imagePublicId,
    });

    // 5. Atualiza total_itens do levantamento
    await this.writeRepository.incrementTotalItens(levantamentoId);

    // 6. Vincula tags se informadas
    if (input.tags?.length) {
      await this.writeRepository.criarItemTags(levantamentoItem.id, input.tags);
    }

    // Hook C.3: auto-criar foco se o item qualifica (best-effort)
    try {
      await this.criarFocoDeLevantamentoItem.execute({
        clienteId,
        itemId: levantamentoItem.id,
        levantamentoId,
        latitude: levantamentoItem.latitude ?? null,
        longitude: levantamentoItem.longitude ?? null,
        prioridade: levantamentoItem.prioridade ?? null,
        risco: levantamentoItem.risco ?? null,
        enderecoCurto: levantamentoItem.enderecoCurto ?? null,
        payload: (levantamentoItem.payload ?? null) as Record<string, unknown> | null,
        createdAt: levantamentoItem.createdAt ?? new Date(),
      });
    } catch (err) {
      this.logger.error(
        `Hook CriarFocoDeLevantamentoItem falhou: item=${levantamentoItem.id} erro=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { levantamentoItem, levantamentoCriado, levantamentoId };
  }
}
