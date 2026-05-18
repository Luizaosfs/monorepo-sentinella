import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { EPIDEMIOLOGICAL_MATCH_RADIUS_METERS } from '../../notificacao/constants/epidemiological.constants';

/**
 * E.1.2 — Cruzamento epidemiológico oficial na direção foco → casos.
 *
 * Espelho determinístico de `CruzarCasoComFocos` (direção caso → focos), porém
 * disparado quando um foco é **confirmado** pela operação (vistoria do agente,
 * transição manual para `confirmado`, ou auto-criação por depósito já confirmado).
 *
 * Regras (paridade com o schema E.1.1 — verificado no dump live 2026-05-14):
 *   1. `caso_foco_cruzamento` usa `foco_risco_id` como vínculo (NOT NULL);
 *      `levantamento_item_id` é auxiliar opcional. NÃO depende de o foco ter
 *      origem em levantamento — denúncia cidadã confirmada também cruza.
 *   2. Unique key real: `(caso_id, foco_risco_id)` → ON CONFLICT DO NOTHING
 *      (idempotente; reconfirmação não duplica linha).
 *   3. Pressão epidemiológica eleva o foco a `prioridade='P1'` e registra
 *      `prioridade_original_antes_caso`, mas SOMENTE quando o foco ainda não
 *      está em P1 (`prioridade IS DISTINCT FROM 'P1'`) — nunca rebaixa nem
 *      sobrescreve prioridade já máxima. Guarda legada preservada.
 *   4. Casos `descartado`/`deleted_at` são ignorados.
 *
 * Best-effort por contrato: o caller envolve a chamada em try/catch. Falha
 * aqui NUNCA reverte a confirmação do foco — cruzamento é otimizador
 * operacional, não bloqueia fluxo de negócio.
 */
export interface CruzarFocoConfirmadoComCasosInput {
  focoId: string | undefined;
  clienteId: string;
  /** Opcionais — quando ausentes, são resolvidos da própria linha do foco. */
  latitude?: number | null;
  longitude?: number | null;
}

export interface CruzarFocoConfirmadoComCasosResult {
  cruzamentos: number;
  casos: number;
}

@Injectable()
export class CruzarFocoConfirmadoComCasos {
  private readonly logger = new Logger(CruzarFocoConfirmadoComCasos.name);

  constructor(private prisma: PrismaService) {}

  async execute(
    input: CruzarFocoConfirmadoComCasosInput,
  ): Promise<CruzarFocoConfirmadoComCasosResult> {
    const { focoId, clienteId } = input;

    if (!focoId) {
      return { cruzamentos: 0, casos: 0 };
    }

    // O foco é o sujeito do cruzamento: sua linha é a fonte de verdade das
    // coordenadas e do levantamento_item auxiliar. Resolvemos sempre do banco
    // (escopado por cliente) — evita coordenadas defasadas vindas do caller.
    const [foco] = await this.prisma.client.$queryRaw<
      Array<{
        latitude: number | null;
        longitude: number | null;
        origem_levantamento_item_id: string | null;
      }>
    >(Prisma.sql`
      SELECT latitude, longitude, origem_levantamento_item_id
      FROM focos_risco
      WHERE id = ${focoId}::uuid
        AND cliente_id = ${clienteId}::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `);

    if (!foco) {
      return { cruzamentos: 0, casos: 0 };
    }

    const latitude = input.latitude ?? foco.latitude;
    const longitude = input.longitude ?? foco.longitude;
    const levantamentoItemId = foco.origem_levantamento_item_id;

    if (latitude == null || longitude == null) {
      return { cruzamentos: 0, casos: 0 };
    }

    const casos = await this.prisma.client.$queryRaw<
      Array<{ id: string; distancia_metros: number }>
    >(Prisma.sql`
      SELECT
        cn.id,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(cn.longitude, cn.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
        ) AS distancia_metros
      FROM casos_notificados cn
      WHERE cn.cliente_id = ${clienteId}::uuid
        AND cn.deleted_at IS NULL
        AND cn.latitude IS NOT NULL
        AND cn.longitude IS NOT NULL
        AND cn.status <> 'descartado'
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(cn.longitude, cn.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${EPIDEMIOLOGICAL_MATCH_RADIUS_METERS}
        )
    `);

    if (casos.length === 0) {
      return { cruzamentos: 0, casos: 0 };
    }

    let inseridos = 0;
    for (const caso of casos) {
      const r = await this.prisma.client.$executeRaw(Prisma.sql`
        INSERT INTO caso_foco_cruzamento
          (caso_id, foco_risco_id, levantamento_item_id, distancia_metros)
        VALUES
          (${caso.id}::uuid, ${focoId}::uuid, ${levantamentoItemId ?? null}::uuid, ${caso.distancia_metros})
        ON CONFLICT (caso_id, foco_risco_id) DO NOTHING
      `);
      inseridos += Number(r) || 0;
    }

    const casosIds = casos.map((c) => c.id);

    // Pressão epidemiológica: eleva para P1 e registra prioridade anterior.
    // Guarda legada preservada — só altera foco que ainda não está em P1
    // (não rebaixa, não sobrescreve prioridade já máxima).
    await this.prisma.client.$executeRaw(Prisma.sql`
      UPDATE focos_risco
      SET
        casos_ids = (
          SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::uuid[])
          FROM unnest(casos_ids || ${casosIds}::uuid[]) AS x
        ),
        prioridade_original_antes_caso = COALESCE(prioridade_original_antes_caso, prioridade),
        prioridade = 'P1'
      WHERE id = ${focoId}::uuid
        AND prioridade IS DISTINCT FROM 'P1'
    `);

    this.logger.debug(
      `Foco confirmado ${focoId} cruzado com ${casos.length} caso(s); ` +
        `${inseridos} novo(s) cruzamento(s).`,
    );

    return { cruzamentos: inseridos, casos: casos.length };
  }
}
