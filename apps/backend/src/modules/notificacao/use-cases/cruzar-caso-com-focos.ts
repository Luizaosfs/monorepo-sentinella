import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  EPIDEMIOLOGICAL_MATCH_RADIUS_METERS,
  FOCO_ATIVO_MAX_INATIVIDADE_DIAS,
} from '../constants/epidemiological.constants';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

/**
 * E.1.1 — Versão hardened do trigger legado `fn_cruzar_caso_com_focos`.
 *
 * Mudanças em relação à Fase C.4:
 *   1. Dedupe ampla: busca QUALQUER foco ativo (não só focos com levantamento_item_id).
 *      Focos de drone, agente, cidadão e epidemiológicos são todos elegíveis.
 *   2. Filtro temporal: focos sem atividade há mais de FOCO_ATIVO_MAX_INATIVIDADE_DIAS
 *      não absorvem novos casos (evita reativar focos abandonados).
 *   3. Foco principal determinístico: o primeiro da lista ordenada por
 *      (distância ASC → prioridade P1>P5 ASC → updated_at DESC) é o foco
 *      operacional que absorve o caso como vínculo principal.
 *   4. Vínculo principal persistido em casos_notificados.foco_risco_id
 *      (campo permanente — não apagado ao descartar o caso).
 *   5. caso_foco_cruzamento usa foco_risco_id como chave (não levantamento_item_id).
 *   6. Raio centralizado em EPIDEMIOLOGICAL_MATCH_RADIUS_METERS.
 *
 * Guarda legada preservada: focos já em P1 não recebem o caso_id em casos_ids
 * (comportamento original de fn_cruzar_caso_com_focos).
 */
export interface CruzarCasoComFocosInput {
  casoId: string | undefined;
  clienteId: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
}

export interface CruzarCasoComFocosResult {
  cruzamentos: number;
  principalFocoId: string | null;
  principalDistanciaMetros: number | null;
}

@Injectable()
export class CruzarCasoComFocos {
  private readonly logger = new Logger(CruzarCasoComFocos.name);

  constructor(
    private prisma: PrismaService,
    private writeRepository: NotificacaoWriteRepository,
  ) {}

  async execute(input: CruzarCasoComFocosInput): Promise<CruzarCasoComFocosResult> {
    const { casoId, clienteId, latitude, longitude } = input;

    if (!casoId || latitude == null || longitude == null) {
      return { cruzamentos: 0, principalFocoId: null, principalDistanciaMetros: null };
    }

    // Busca todos os focos ativos no raio — ordenados deterministicamente:
    //   1. Menor distância (mais próximo primeiro)
    //   2. Maior criticidade (P1 antes de P2, etc.)
    //   3. Mais recente (maior updated_at)
    // O primeiro resultado é o "foco principal" que absorve operacionalmente o caso.
    const focos = await this.prisma.client.$queryRaw<
      Array<{
        id: string;
        levantamento_item_id: string | null;
        distancia_metros: number;
        prioridade: string | null;
      }>
    >(Prisma.sql`
      SELECT
        f.id,
        f.origem_levantamento_item_id AS levantamento_item_id,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(f.longitude, f.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
        ) AS distancia_metros,
        f.prioridade
      FROM focos_risco f
      WHERE f.cliente_id = ${clienteId}::uuid
        AND f.deleted_at IS NULL
        AND f.latitude  IS NOT NULL
        AND f.longitude IS NOT NULL
        AND f.status NOT IN ('resolvido', 'descartado')
        AND f.updated_at >= now() - (${FOCO_ATIVO_MAX_INATIVIDADE_DIAS} || ' days')::interval
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(f.longitude, f.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${EPIDEMIOLOGICAL_MATCH_RADIUS_METERS}
        )
      ORDER BY
        distancia_metros ASC,
        CASE f.prioridade
          WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3
          WHEN 'P4' THEN 4 WHEN 'P5' THEN 5 ELSE 99
        END ASC,
        f.updated_at DESC
    `);

    if (focos.length === 0) {
      return { cruzamentos: 0, principalFocoId: null, principalDistanciaMetros: null };
    }

    const principal = focos[0];
    let inseridos = 0;

    for (const foco of focos) {
      // Cruzamento analítico (todos os focos no raio)
      const result = await this.prisma.client.$executeRaw(Prisma.sql`
        INSERT INTO caso_foco_cruzamento
          (caso_id, foco_risco_id, levantamento_item_id, distancia_metros)
        VALUES
          (${casoId}::uuid, ${foco.id}::uuid, ${foco.levantamento_item_id ?? null}::uuid, ${foco.distancia_metros})
        ON CONFLICT (caso_id, foco_risco_id) DO NOTHING
      `);
      inseridos += Number(result) || 0;

      // Pressão epidemiológica: eleva prioridade para P1 e registra casos_ids.
      // Guarda legada preservada: focos já em P1 não recebem o caso_id em casos_ids.
      await this.prisma.client.$executeRaw(Prisma.sql`
        UPDATE focos_risco
        SET
          casos_ids = (
            CASE
              WHEN ${casoId}::uuid = ANY(casos_ids) THEN casos_ids
              ELSE array_append(casos_ids, ${casoId}::uuid)
            END
          ),
          prioridade_original_antes_caso = COALESCE(prioridade_original_antes_caso, prioridade),
          prioridade = 'P1'
        WHERE id = ${foco.id}::uuid
          AND prioridade IS DISTINCT FROM 'P1'
      `);
    }

    // Vínculo operacional principal — via repositório do domínio (permanente, não apagado ao descartar)
    await this.writeRepository.vincularFoco(casoId, {
      focoRiscoId: principal.id,
      vinculadoEm: new Date(),
      vinculoTipo: 'existente_300m',
      distanciaMetros: principal.distancia_metros,
    });

    this.logger.debug(
      `Caso ${casoId} cruzado com ${focos.length} foco(s); ` +
      `principal=${principal.id} dist=${principal.distancia_metros.toFixed(0)}m; ` +
      `${inseridos} novo(s) cruzamento(s).`,
    );

    return {
      cruzamentos: inseridos,
      principalFocoId: principal.id,
      principalDistanciaMetros: principal.distancia_metros,
    };
  }
}
