import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { DashboardTerritorialQuery } from '../dtos/dashboard-territorial.dto';

interface KpiRow {
  total_focos: bigint;
  focos_ativos: bigint;
  focos_resolvidos: bigint;
  focos_descartados: bigint;
  taxa_resolucao_pct: number | null;
  vistorias_realizadas: bigint;
  sla_vencidos: bigint;
  calculado_em: Date;
}

interface BairroRow {
  bairro: string;
  total_focos: bigint;
  focos_ativos: bigint;
  vistorias_realizadas: bigint;
  sla_vencidos: bigint;
}

interface RegiaoRow {
  regiao_id: string;
  regiao_nome: string;
  total_focos: bigint;
  focos_ativos: bigint;
  vistorias_realizadas: bigint;
}

interface MapaRow {
  id: string;
  latitude: number;
  longitude: number;
  status: string;
  prioridade: string | null;
  // Peso por prioridade real: P1=5, P2=4, P3=3, P4=2, demais=1
  peso: number;
}

interface DepositoRow {
  tipo: string;
  qtd_inspecionados: bigint;
  qtd_com_focos: bigint;
  qtd_eliminados: bigint;
  qtd_com_agua: bigint;
}

interface RiscoRow {
  menor_incapaz: bigint;
  idoso_incapaz: bigint;
  dep_quimico: bigint;
  risco_alimentar: bigint;
  risco_moradia: bigint;
  criadouro_animais: bigint;
  lixo: bigint;
  residuos_organicos: bigint;
  animais_sinais_lv: bigint;
  caixa_destampada: bigint;
  mobilidade_reduzida: bigint;
  acamado: bigint;
}

interface CalhaRow {
  calhas_criticas: bigint;
  calhas_tratadas: bigint;
}

@Injectable()
export class GetDashboardTerritorial {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, params: DashboardTerritorialQuery) {
    // Filtros parameterizados — sem concatenação de SQL
    const fDataInicio = params.dataInicio
      ? Prisma.sql`AND f.suspeita_em >= ${new Date(params.dataInicio + 'T00:00:00Z')}`
      : Prisma.empty;

    const fDataFim = params.dataFim
      ? Prisma.sql`AND f.suspeita_em < ${new Date(params.dataFim + 'T23:59:59Z')}`
      : Prisma.empty;

    // imoveis.bairro é campo texto — sem tabela bairros separada
    const fBairro = params.bairro
      ? Prisma.sql`AND COALESCE(im.bairro, '') = ${params.bairro}`
      : Prisma.empty;

    const fRegiaoId = params.regiaoId
      ? Prisma.sql`AND f.regiao_id = ${params.regiaoId}::uuid`
      : Prisma.empty;

    const fPrioridade = params.prioridade
      ? Prisma.sql`AND f.prioridade = ${params.prioridade}`
      : Prisma.empty;

    const fStatus = params.status
      ? Prisma.sql`AND f.status = ${params.status}`
      : Prisma.empty;

    // Para queries com LEFT JOIN vistorias: usar EXISTS para não colapsar contagens
    const fAgenteIdExists = params.agenteId
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM vistorias vf
          WHERE vf.foco_risco_id = f.id
            AND vf.agente_id = ${params.agenteId}::uuid
            AND vf.deleted_at IS NULL
        )`
      : Prisma.empty;

    // Para queries com INNER JOIN vistorias: filtro direto na tabela
    const fAgenteIdDirect = params.agenteId
      ? Prisma.sql`AND v.agente_id = ${params.agenteId}::uuid`
      : Prisma.empty;

    const [kpisRaw, bairrosRaw, regioesRaw, mapaRaw, depositosRaw, riscosRaw, calhasRaw] =
      await Promise.all([
        // 1. KPIs globais
        this.prisma.client.$queryRaw<KpiRow[]>(Prisma.sql`
          SELECT
            COUNT(DISTINCT f.id) AS total_focos,
            COUNT(DISTINCT f.id) FILTER (WHERE f.status NOT IN ('suspeita', 'descartado', 'resolvido')) AS focos_ativos,
            COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'resolvido') AS focos_resolvidos,
            COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'descartado') AS focos_descartados,
            ROUND(CASE
              WHEN COUNT(DISTINCT f.id) FILTER (WHERE f.status NOT IN ('suspeita','descartado')) > 0
              THEN COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'resolvido')::numeric
                 / COUNT(DISTINCT f.id) FILTER (WHERE f.status NOT IN ('suspeita','descartado'))::numeric * 100
              ELSE 0
            END, 1)::float8 AS taxa_resolucao_pct,
            COUNT(DISTINCT v.id) AS vistorias_realizadas,
            COUNT(DISTINCT sl.id) FILTER (WHERE sl.violado = true) AS sla_vencidos,
            now() AS calculado_em
          FROM focos_risco f
          LEFT JOIN imoveis im ON im.id = f.imovel_id AND im.deleted_at IS NULL
          LEFT JOIN vistorias v ON v.foco_risco_id = f.id AND v.deleted_at IS NULL
          LEFT JOIN sla_operacional sl ON sl.foco_risco_id = f.id AND sl.deleted_at IS NULL
          WHERE f.cliente_id = ${clienteId}::uuid
            AND f.deleted_at IS NULL
            ${fDataInicio}
            ${fDataFim}
            ${fBairro}
            ${fRegiaoId}
            ${fPrioridade}
            ${fStatus}
            ${fAgenteIdExists}
        `),

        // 2. Ranking por bairro (top 20 por focos_ativos)
        this.prisma.client.$queryRaw<BairroRow[]>(Prisma.sql`
          SELECT
            COALESCE(im.bairro, '(sem bairro)') AS bairro,
            COUNT(DISTINCT f.id) AS total_focos,
            COUNT(DISTINCT f.id) FILTER (WHERE f.status NOT IN ('suspeita', 'descartado', 'resolvido')) AS focos_ativos,
            COUNT(DISTINCT v.id) AS vistorias_realizadas,
            COUNT(DISTINCT sl.id) FILTER (WHERE sl.violado = true) AS sla_vencidos
          FROM focos_risco f
          LEFT JOIN imoveis im ON im.id = f.imovel_id AND im.deleted_at IS NULL
          LEFT JOIN vistorias v ON v.foco_risco_id = f.id AND v.deleted_at IS NULL
          LEFT JOIN sla_operacional sl ON sl.foco_risco_id = f.id AND sl.deleted_at IS NULL
          WHERE f.cliente_id = ${clienteId}::uuid
            AND f.deleted_at IS NULL
            ${fDataInicio}
            ${fDataFim}
            ${fBairro}
            ${fRegiaoId}
            ${fPrioridade}
            ${fStatus}
            ${fAgenteIdExists}
          GROUP BY COALESCE(im.bairro, '(sem bairro)')
          ORDER BY focos_ativos DESC, total_focos DESC
          LIMIT 20
        `),

        // 3. Ranking por região (top 20)
        this.prisma.client.$queryRaw<RegiaoRow[]>(Prisma.sql`
          SELECT
            r.id AS regiao_id,
            r.nome AS regiao_nome,
            COUNT(DISTINCT f.id) AS total_focos,
            COUNT(DISTINCT f.id) FILTER (WHERE f.status NOT IN ('suspeita', 'descartado', 'resolvido')) AS focos_ativos,
            COUNT(DISTINCT v.id) AS vistorias_realizadas
          FROM focos_risco f
          JOIN regioes r ON r.id = f.regiao_id
          LEFT JOIN imoveis im ON im.id = f.imovel_id AND im.deleted_at IS NULL
          LEFT JOIN vistorias v ON v.foco_risco_id = f.id AND v.deleted_at IS NULL
          WHERE f.cliente_id = ${clienteId}::uuid
            AND f.deleted_at IS NULL
            AND f.regiao_id IS NOT NULL
            ${fDataInicio}
            ${fDataFim}
            ${fBairro}
            ${fRegiaoId}
            ${fPrioridade}
            ${fStatus}
            ${fAgenteIdExists}
          GROUP BY r.id, r.nome
          ORDER BY focos_ativos DESC, total_focos DESC
          LIMIT 20
        `),

        // 4. Pontos mapa — apenas focos com coordenadas (máx. 500)
        // Peso por prioridade real: P1=5, P2=4, P3=3, P4=2, demais=1
        this.prisma.client.$queryRaw<MapaRow[]>(Prisma.sql`
          SELECT
            f.id,
            f.latitude::float8,
            f.longitude::float8,
            f.status,
            f.prioridade,
            CASE f.prioridade
              WHEN 'P1' THEN 5
              WHEN 'P2' THEN 4
              WHEN 'P3' THEN 3
              WHEN 'P4' THEN 2
              ELSE 1
            END AS peso
          FROM focos_risco f
          LEFT JOIN imoveis im ON im.id = f.imovel_id AND im.deleted_at IS NULL
          WHERE f.cliente_id = ${clienteId}::uuid
            AND f.deleted_at IS NULL
            AND f.latitude IS NOT NULL
            AND f.longitude IS NOT NULL
            ${fDataInicio}
            ${fDataFim}
            ${fBairro}
            ${fRegiaoId}
            ${fPrioridade}
            ${fStatus}
            ${fAgenteIdExists}
          ORDER BY f.prioridade NULLS LAST, f.suspeita_em DESC
          LIMIT 500
        `),

        // 5. Depósitos PNCD agregados por tipo
        this.prisma.client.$queryRaw<DepositoRow[]>(Prisma.sql`
          SELECT
            vd.tipo,
            SUM(vd.qtd_inspecionados)::bigint AS qtd_inspecionados,
            SUM(vd.qtd_com_focos)::bigint AS qtd_com_focos,
            SUM(vd.qtd_eliminados)::bigint AS qtd_eliminados,
            SUM(vd.qtd_com_agua)::bigint AS qtd_com_agua
          FROM vistoria_depositos vd
          JOIN vistorias v ON v.id = vd.vistoria_id AND v.deleted_at IS NULL
          JOIN focos_risco f ON f.id = v.foco_risco_id AND f.deleted_at IS NULL
          LEFT JOIN imoveis im ON im.id = f.imovel_id AND im.deleted_at IS NULL
          WHERE f.cliente_id = ${clienteId}::uuid
            ${fDataInicio}
            ${fDataFim}
            ${fBairro}
            ${fRegiaoId}
            ${fPrioridade}
            ${fStatus}
            ${fAgenteIdDirect}
          GROUP BY vd.tipo
          ORDER BY qtd_com_focos DESC
        `),

        // 6. Fatores de risco — contagem de campos reais em vistoria_riscos
        this.prisma.client.$queryRaw<RiscoRow[]>(Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE vr.menor_incapaz = true)::bigint AS menor_incapaz,
            COUNT(*) FILTER (WHERE vr.idoso_incapaz = true)::bigint AS idoso_incapaz,
            COUNT(*) FILTER (WHERE vr.dep_quimico = true)::bigint AS dep_quimico,
            COUNT(*) FILTER (WHERE vr.risco_alimentar = true)::bigint AS risco_alimentar,
            COUNT(*) FILTER (WHERE vr.risco_moradia = true)::bigint AS risco_moradia,
            COUNT(*) FILTER (WHERE vr.criadouro_animais = true)::bigint AS criadouro_animais,
            COUNT(*) FILTER (WHERE vr.lixo = true)::bigint AS lixo,
            COUNT(*) FILTER (WHERE vr.residuos_organicos = true)::bigint AS residuos_organicos,
            COUNT(*) FILTER (WHERE vr.animais_sinais_lv = true)::bigint AS animais_sinais_lv,
            COUNT(*) FILTER (WHERE vr.caixa_destampada = true)::bigint AS caixa_destampada,
            COUNT(*) FILTER (WHERE vr.mobilidade_reduzida = true)::bigint AS mobilidade_reduzida,
            COUNT(*) FILTER (WHERE vr.acamado = true)::bigint AS acamado
          FROM vistoria_riscos vr
          JOIN vistorias v ON v.id = vr.vistoria_id AND v.deleted_at IS NULL
          JOIN focos_risco f ON f.id = v.foco_risco_id AND f.deleted_at IS NULL
          LEFT JOIN imoveis im ON im.id = f.imovel_id AND im.deleted_at IS NULL
          WHERE f.cliente_id = ${clienteId}::uuid
            ${fDataInicio}
            ${fDataFim}
            ${fBairro}
            ${fRegiaoId}
            ${fPrioridade}
            ${fStatus}
            ${fAgenteIdDirect}
        `),

        // 7. Calhas com foco e tratadas
        this.prisma.client.$queryRaw<CalhaRow[]>(Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE vc.com_foco = true)::bigint AS calhas_criticas,
            COUNT(*) FILTER (WHERE vc.tratamento_realizado = true)::bigint AS calhas_tratadas
          FROM vistoria_calhas vc
          JOIN vistorias v ON v.id = vc.vistoria_id AND v.deleted_at IS NULL
          JOIN focos_risco f ON f.id = v.foco_risco_id AND f.deleted_at IS NULL
          LEFT JOIN imoveis im ON im.id = f.imovel_id AND im.deleted_at IS NULL
          WHERE f.cliente_id = ${clienteId}::uuid
            ${fDataInicio}
            ${fDataFim}
            ${fBairro}
            ${fRegiaoId}
            ${fPrioridade}
            ${fStatus}
            ${fAgenteIdDirect}
        `),
      ]);

    const kpi = kpisRaw[0];
    const calha = calhasRaw[0];
    const risco = riscosRaw[0];

    return {
      kpis: {
        totalFocos: Number(kpi?.total_focos ?? 0),
        focosAtivos: Number(kpi?.focos_ativos ?? 0),
        focosResolvidos: Number(kpi?.focos_resolvidos ?? 0),
        focosDescartados: Number(kpi?.focos_descartados ?? 0),
        taxaResolucaoPct: kpi?.taxa_resolucao_pct ?? null,
        vistoriasRealizadas: Number(kpi?.vistorias_realizadas ?? 0),
        slaVencidos: Number(kpi?.sla_vencidos ?? 0),
        calhasCriticas: Number(calha?.calhas_criticas ?? 0),
        calhasTratadas: Number(calha?.calhas_tratadas ?? 0),
        calculadoEm: kpi?.calculado_em ?? new Date(),
      },
      rankingBairro: bairrosRaw.map((r) => ({
        bairro: r.bairro,
        totalFocos: Number(r.total_focos),
        focosAtivos: Number(r.focos_ativos),
        vistoriasRealizadas: Number(r.vistorias_realizadas),
        slaVencidos: Number(r.sla_vencidos),
      })),
      rankingRegiao: regioesRaw.map((r) => ({
        regiaoId: r.regiao_id,
        regiaoNome: r.regiao_nome,
        totalFocos: Number(r.total_focos),
        focosAtivos: Number(r.focos_ativos),
        vistoriasRealizadas: Number(r.vistorias_realizadas),
      })),
      pontosMapa: mapaRaw.map((r) => ({
        id: r.id,
        latitude: r.latitude,
        longitude: r.longitude,
        status: r.status,
        prioridade: r.prioridade ?? null,
        peso: Number(r.peso),
      })),
      depositosPncd: {
        totais: {
          inspecionados: depositosRaw.reduce((s, r) => s + Number(r.qtd_inspecionados), 0),
          comFoco: depositosRaw.reduce((s, r) => s + Number(r.qtd_com_focos), 0),
          eliminados: depositosRaw.reduce((s, r) => s + Number(r.qtd_eliminados), 0),
          comAgua: depositosRaw.reduce((s, r) => s + Number(r.qtd_com_agua), 0),
        },
        porTipo: depositosRaw.map((r) => ({
          tipo: r.tipo,
          qtdInspecionados: Number(r.qtd_inspecionados),
          qtdComFocos: Number(r.qtd_com_focos),
          qtdEliminados: Number(r.qtd_eliminados),
          qtdComAgua: Number(r.qtd_com_agua),
        })),
      },
      fatoresRisco: risco
        ? {
            menorIncapaz: Number(risco.menor_incapaz),
            idosoIncapaz: Number(risco.idoso_incapaz),
            depQuimico: Number(risco.dep_quimico),
            riscoAlimentar: Number(risco.risco_alimentar),
            riscoMoradia: Number(risco.risco_moradia),
            criadouroAnimais: Number(risco.criadouro_animais),
            lixo: Number(risco.lixo),
            residuosOrganicos: Number(risco.residuos_organicos),
            animaisSinaisLv: Number(risco.animais_sinais_lv),
            caixaDestampada: Number(risco.caixa_destampada),
            mobilidadeReduzida: Number(risco.mobilidade_reduzida),
            acamado: Number(risco.acamado),
          }
        : null,
      meta: {
        totalPontosMapa: mapaRaw.length,
        periodoInicio: params.dataInicio ?? null,
        periodoFim: params.dataFim ?? null,
        // peso é peso visual para heatmap — não é índice sanitário nem score calculado
        pesoMapaRegra: 'prioridade_real: P1=5, P2=4, P3=3, P4=2, demais=1',
        filtros: {
          bairro: params.bairro ?? null,
          regiaoId: params.regiaoId ?? null,
          prioridade: params.prioridade ?? null,
          status: params.status ?? null,
          agenteId: params.agenteId ?? null,
        },
        observacoes: [
          'rankingBairro usa imoveis.bairro textual; territorialização canônica por bairroId/regiaoId fica para fase posterior',
        ],
      },
    };
  }
}
