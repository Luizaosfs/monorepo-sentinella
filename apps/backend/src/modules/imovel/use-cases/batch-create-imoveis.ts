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

    // Fase 1: sincroniza mestres de quarteirão e coleta UUIDs antes de criar imóveis.
    // Chave: "<codigo>||<bairroId>" — evita colisão entre bairros com mesmo código.
    const quadraKeyToId = new Map<string, string>();
    const seen = new Set<string>();
    for (const r of data.registros) {
      const codigo = normalizarQuarteirao(r.quarteirao);
      if (!codigo) continue;
      const bairroId = r.regiaoId ?? null;
      const key = `${codigo}||${bairroId ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const uuid = await this.quarteiraoWriteRepository.upsertMestreIfMissing(clienteId, null, codigo, bairroId);
        quadraKeyToId.set(key, uuid);
      } catch (err) {
        this.logger.error(
          `[BatchCreateImoveis] Falha ao sincronizar quarteirao mestre "${codigo}": ${(err as Error).message}`,
        );
      }
    }

    // Fase 2: insere imóveis em chunks incluindo quadra_id resolvido.
    for (let i = 0; i < data.registros.length; i += CHUNK_SIZE) {
      const chunk = data.registros.slice(i, i + CHUNK_SIZE).map((r) => {
        const codigo = normalizarQuarteirao(r.quarteirao);
        const bairroId = r.regiaoId ?? null;
        const key = `${codigo ?? ''}||${bairroId ?? ''}`;
        return {
          cliente_id:           clienteId,
          bairro_id:            bairroId,
          tipo_imovel:          r.tipoImovel ?? 'residencial',
          logradouro:           r.logradouro ?? null,
          numero:               r.numero ?? null,
          complemento:          r.complemento ?? null,
          bairro:               r.bairro ?? null,
          quarteirao:           codigo,
          quadra_id:            codigo ? (quadraKeyToId.get(key) ?? null) : null,
          latitude:             r.latitude ?? null,
          longitude:            r.longitude ?? null,
          ativo:                r.ativo ?? true,
          proprietario_ausente: r.proprietarioAusente ?? false,
          tipo_ausencia:        r.tipoAusencia ?? null,
          contato_proprietario: r.contatoProprietario ?? null,
          tem_animal_agressivo: r.temAnimalAgressivo ?? false,
          historico_recusa:     r.historicoRecusa ?? false,
          tem_calha:            r.temCalha ?? false,
          calha_acessivel:      r.calhaAcessivel ?? true,
          prioridade_drone:     r.prioridadeDrone ?? false,
          notificacao_formal_em: r.notificacaoFormalEm ? new Date(r.notificacaoFormalEm) : null,
        };
      });

      try {
        const result = await this.prisma.client.imoveis.createMany({ data: chunk });
        importados += result.count;
      } catch {
        falhas += chunk.length;
      }
    }

    return { importados, falhas };
  }
}
