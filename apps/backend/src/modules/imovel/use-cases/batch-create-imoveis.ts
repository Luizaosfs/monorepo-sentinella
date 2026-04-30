import { Inject, Injectable, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';
import { QuarteiraoWriteRepository } from '../../quarteirao/repositories/quarteirao-write.repository';
import { BatchCreateImoveisInput } from '../dtos/batch-create-imoveis.body';
import { normalizarQuarteirao } from './normalizar-quarteirao';

const CHUNK_SIZE = 500;

@Injectable()
export class BatchCreateImoveis {
  private readonly logger = new Logger(BatchCreateImoveis.name);

  constructor(
    private prisma: PrismaService,
    private quarteiraoWriteRepository: QuarteiraoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: BatchCreateImoveisInput) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    let importados = 0;
    let falhas = 0;

    for (let i = 0; i < data.registros.length; i += CHUNK_SIZE) {
      const chunk = data.registros.slice(i, i + CHUNK_SIZE).map((r) => ({
        cliente_id:          clienteId,
        regiao_id:           r.regiaoId ?? null,
        tipo_imovel:         r.tipoImovel ?? 'residencial',
        logradouro:          r.logradouro ?? null,
        numero:              r.numero ?? null,
        complemento:         r.complemento ?? null,
        bairro:              r.bairro ?? null,
        quarteirao:          normalizarQuarteirao(r.quarteirao),
        latitude:            r.latitude ?? null,
        longitude:           r.longitude ?? null,
        ativo:               r.ativo ?? true,
        proprietario_ausente: r.proprietarioAusente ?? false,
        tipo_ausencia:       r.tipoAusencia ?? null,
        contato_proprietario: r.contatoProprietario ?? null,
        tem_animal_agressivo: r.temAnimalAgressivo ?? false,
        historico_recusa:    r.historicoRecusa ?? false,
        tem_calha:           r.temCalha ?? false,
        calha_acessivel:     r.calhaAcessivel ?? true,
        prioridade_drone:    r.prioridadeDrone ?? false,
        notificacao_formal_em: r.notificacaoFormalEm ? new Date(r.notificacaoFormalEm) : null,
      }));

      try {
        const result = await this.prisma.client.imoveis.createMany({ data: chunk });
        importados += result.count;
      } catch {
        falhas += chunk.length;
      }
    }

    // K.5 — fn_sync_quarteirao_mestre: deduplica e sincroniza quarteirões (best-effort)
    const codigosUnicos = new Set<string>();
    for (const r of data.registros) {
      const codigo = normalizarQuarteirao(r.quarteirao);
      if (codigo) codigosUnicos.add(codigo);
    }
    for (const codigo of codigosUnicos) {
      try {
        await this.quarteiraoWriteRepository.upsertMestreIfMissing(clienteId, null, codigo);
      } catch (err) {
        this.logger.error(
          `[BatchCreateImoveis] Falha ao sincronizar quarteirao mestre "${codigo}": ${(err as Error).message}`,
        );
      }
    }

    return { importados, falhas };
  }
}
