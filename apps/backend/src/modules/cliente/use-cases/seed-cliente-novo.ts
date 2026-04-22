import { Injectable, Logger } from '@nestjs/common';

export interface SeedClienteNovoResult {
  clientePlano: 'criado' | 'pulado_sem_plano_basico' | 'ja_existente';
  clienteQuotas: 'criado' | 'ja_existente';
  scoreConfig: 'criado' | 'ja_existente';
  slaFocoConfig: { criados: number };
  slaFeriados: { criados: number };
  droneRiskConfig: 'criado' | 'ja_existente';
  yoloClassConfig: { criados: number };
  yoloSynonyms: { criados: number };
  planoAcaoCatalogo: { genericosCriados: number; porTipoCriados: number };
}

interface YoloClass {
  itemKey: string;
  item: string;
  risco: 'alto' | 'medio' | 'baixo';
  peso: number;
  acao: string;
}

interface YoloSynonym {
  synonym: string;
  mapsTo: string;
}

interface PlanoAcaoGenerico {
  label: string;
  descricao: string;
  ordem: number;
}

interface PlanoAcaoPorTipo {
  tipoItem: string;
  label: string;
  descricao: string;
  ordem: number;
}

const SLA_FOCO_FASES: ReadonlyArray<{ fase: string; prazoMinutos: number }> = [
  { fase: 'triagem', prazoMinutos: 480 },
  { fase: 'inspecao', prazoMinutos: 720 },
  { fase: 'confirmacao', prazoMinutos: 1440 },
  { fase: 'tratamento', prazoMinutos: 2880 },
];

const SLA_FERIADOS_NACIONAIS: ReadonlyArray<{ data: string; descricao: string }> = [
  // 2025
  { data: '2025-01-01', descricao: 'Confraternização Universal' },
  { data: '2025-04-18', descricao: 'Sexta-feira Santa' },
  { data: '2025-04-21', descricao: 'Tiradentes' },
  { data: '2025-05-01', descricao: 'Dia do Trabalhador' },
  { data: '2025-09-07', descricao: 'Independência do Brasil' },
  { data: '2025-10-12', descricao: 'Nossa Sra. Aparecida' },
  { data: '2025-11-02', descricao: 'Finados' },
  { data: '2025-11-15', descricao: 'Proclamação da República' },
  { data: '2025-11-20', descricao: 'Consciência Negra' },
  { data: '2025-12-25', descricao: 'Natal' },
  // 2026
  { data: '2026-01-01', descricao: 'Confraternização Universal' },
  { data: '2026-04-03', descricao: 'Sexta-feira Santa' },
  { data: '2026-04-21', descricao: 'Tiradentes' },
  { data: '2026-05-01', descricao: 'Dia do Trabalhador' },
  { data: '2026-09-07', descricao: 'Independência do Brasil' },
  { data: '2026-10-12', descricao: 'Nossa Sra. Aparecida' },
  { data: '2026-11-02', descricao: 'Finados' },
  { data: '2026-11-15', descricao: 'Proclamação da República' },
  { data: '2026-11-20', descricao: 'Consciência Negra' },
  { data: '2026-12-25', descricao: 'Natal' },
];

const DRONE_BASE_BY_RISCO = { baixo: 25, medio: 55, alto: 85 };
const DRONE_PRIORITY_THRESHOLDS = { P1: 85, P2: 60, P3: 40, P4: 20, P5: 0 };
const DRONE_SLA_BY_PRIORITY_HOURS = { P1: 24, P2: 72, P3: 168, P4: 336, P5: 720 };
const DRONE_ITEM_OVERRIDES = {
  caixa_dagua_aberta: { min_score: 90, force_priority: 'P1' },
  pneu: { min_score: 85 },
  tambor: { min_score: 80 },
  calha_suja: { min_score: 60 },
  entulho: { min_score: 55 },
};
const DRONE_CONFIDENCE_MULTIPLIER = 1.0;

const YOLO_CLASSES: ReadonlyArray<YoloClass> = [
  {
    itemKey: 'pneu',
    item: 'pneu',
    risco: 'alto',
    peso: 95,
    acao: 'Vistoria imediata | Remover/descartar corretamente | Orientar responsável | Notificação se reincidente',
  },
  {
    itemKey: 'tambor',
    item: 'tambor',
    risco: 'alto',
    peso: 90,
    acao: 'Vistoria imediata | Esvaziar e vedar/armazenar corretamente | Larvicida se necessário | Orientar responsável',
  },
  {
    itemKey: 'caixa_dagua',
    item: 'caixa_dagua',
    risco: 'baixo',
    peso: 30,
    acao: 'Verificar se está tampada | Orientar tampar se aberta',
  },
  {
    itemKey: 'caixa_dagua_aberta',
    item: 'caixa_dagua_aberta',
    risco: 'alto',
    peso: 98,
    acao: "Vistoria imediata | Tampar/vedar caixa d'água | Verificar outros reservatórios | Orientar e notificar responsável",
  },
  {
    itemKey: 'calha_suja',
    item: 'calha_suja',
    risco: 'medio',
    peso: 65,
    acao: 'Vistoria no local | Limpeza de calhas e ralos | Orientar responsável | Reinspeção em 7 dias',
  },
  {
    itemKey: 'entulho',
    item: 'entulho',
    risco: 'medio',
    peso: 60,
    acao: 'Vistoria no local | Remoção/limpeza | Orientar responsável | Notificação se reincidente',
  },
  {
    itemKey: 'piscina_suja_verde',
    item: 'piscina_suja_verde',
    risco: 'alto',
    peso: 92,
    acao: 'Vistoria imediata | Tratamento da água | Limpeza | Orientar responsável',
  },
  {
    itemKey: 'agua_piscina_verde',
    item: 'agua_piscina_verde',
    risco: 'alto',
    peso: 90,
    acao: 'Vistoria imediata | Esvaziar/tratar água parada | Orientar responsável',
  },
];

const YOLO_SYNONYMS: ReadonlyArray<YoloSynonym> = [
  { synonym: 'caixa_agua_aberta', mapsTo: 'caixa_dagua_aberta' },
  { synonym: 'caixa_agua', mapsTo: 'caixa_dagua' },
  { synonym: 'pneu_velho', mapsTo: 'pneu' },
  { synonym: 'piscina_verde', mapsTo: 'piscina_suja_verde' },
  { synonym: 'agua_parada', mapsTo: 'agua_piscina_verde' },
];

const PLANO_ACAO_GENERICOS: ReadonlyArray<PlanoAcaoGenerico> = [
  { label: 'Remoção de criadouro', descricao: 'Eliminação física do foco de reprodução do mosquito.', ordem: 1 },
  { label: 'Aplicação de larvicida', descricao: 'Tratamento do foco com produto larvicida homologado.', ordem: 2 },
  { label: 'Aplicação de adulticida', descricao: 'Nebulização ou pulverização para eliminar mosquitos adultos.', ordem: 3 },
  { label: 'Tampa/vedação de reservatório', descricao: "Instalação ou ajuste de tampa em caixas d'água, tambores e similares.", ordem: 4 },
  { label: 'Descarte de recipiente', descricao: 'Retirada e descarte adequado de recipientes acumuladores de água.', ordem: 5 },
  { label: 'Limpeza de calha ou sarjeta', descricao: 'Desobstrução de calhas, sarjetas e bueiros com água estagnada.', ordem: 6 },
  { label: 'Orientação ao morador', descricao: 'Informação e conscientização do responsável pelo imóvel.', ordem: 7 },
  { label: 'Notificação ao proprietário', descricao: 'Emissão de notificação formal ao proprietário do imóvel.', ordem: 8 },
  { label: 'Encaminhamento à vigilância', descricao: 'Encaminhamento do caso à equipe de vigilância epidemiológica.', ordem: 9 },
  { label: 'Visita de retorno agendada', descricao: 'Caso não solucionado; agendamento de nova visita para acompanhamento.', ordem: 10 },
];

const PLANO_ACAO_POR_TIPO: ReadonlyArray<PlanoAcaoPorTipo> = [
  {
    tipoItem: 'pneu',
    label: 'Coletar e descartar adequadamente',
    descricao: 'Recolher pneu e encaminhar para descarte correto (borracharia, coleta seletiva ou ponto de entrega voluntária).',
    ordem: 11,
  },
  {
    tipoItem: 'recipiente',
    label: 'Eliminar água acumulada',
    descricao: 'Esvaziar, virar ou remover o recipiente para evitar acúmulo de água parada.',
    ordem: 12,
  },
  {
    tipoItem: 'piscina_suja',
    label: 'Tratamento e limpeza da piscina suja',
    descricao: 'Vistoria imediata; tratamento da água, limpeza e orientação ao responsável.',
    ordem: 13,
  },
  {
    tipoItem: 'caixa_dagua',
    label: 'Tampar ou aplicar larvicida',
    descricao: "Instalar tampa adequada na caixa d'água ou aplicar larvicida homologado; orientar responsável.",
    ordem: 14,
  },
  {
    tipoItem: 'lixo',
    label: 'Remover entulho e materiais acumulados',
    descricao: 'Acionar coleta de entulho ou mutirão de limpeza; orientar descarte correto ao morador.',
    ordem: 15,
  },
  {
    tipoItem: 'poca',
    label: 'Drenagem local',
    descricao: 'Realizar drenagem da poça; verificar causa (pavimentação, sarjeta entupida) e acionar equipe de obras se necessário.',
    ordem: 16,
  },
  {
    tipoItem: 'calha',
    label: 'Limpar calha e verificar escoamento',
    descricao: 'Desobstruir calha e garantir escoamento adequado; orientar morador sobre limpeza periódica.',
    ordem: 17,
  },
  {
    tipoItem: 'vaso_planta',
    label: 'Verificar acúmulo de água no prato',
    descricao: 'Orientar morador a esvaziar pratos de vasos regularmente; sugerir areia no prato como alternativa.',
    ordem: 18,
  },
  {
    tipoItem: 'tampa',
    label: 'Tampar ou eliminar recipiente',
    descricao: 'Tampar hermeticamente ou descartar o recipiente; verificar se há larvas antes de esvaziar.',
    ordem: 19,
  },
  {
    tipoItem: 'barril',
    label: 'Tampar hermeticamente ou esvaziar',
    descricao: 'Instalar tampa vedante no barril/tonel ou esvaziar e virar; aplicar larvicida se não for possível esvaziar.',
    ordem: 20,
  },
  {
    tipoItem: 'piscina_limpa',
    label: 'Manter cloração e limpeza',
    descricao: 'Sem foco típico (água limpa/tratada); manter cloração e limpeza; registrar para auditoria.',
    ordem: 21,
  },
  {
    tipoItem: 'caixa_dagua_fechada',
    label: 'Registrar reservatório vedado',
    descricao: 'Sem foco típico (reservatório vedado); registrar para auditoria; reclassificar se houver indício de brechas.',
    ordem: 22,
  },
];

type TxClient = {
  planos: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  cliente_plano: {
    findUnique: (args: unknown) => Promise<unknown | null>;
    create: (args: unknown) => Promise<unknown>;
  };
  cliente_quotas: { upsert: (args: unknown) => Promise<unknown> };
  score_config: { upsert: (args: unknown) => Promise<unknown> };
  sla_foco_config: { createMany: (args: unknown) => Promise<{ count: number }> };
  sla_feriados: { createMany: (args: unknown) => Promise<{ count: number }> };
  sentinela_drone_risk_config: { upsert: (args: unknown) => Promise<unknown> };
  sentinela_yolo_class_config: { createMany: (args: unknown) => Promise<{ count: number }> };
  sentinela_yolo_synonym: { createMany: (args: unknown) => Promise<{ count: number }> };
  plano_acao_catalogo: {
    count: (args: unknown) => Promise<number>;
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
};

@Injectable()
export class SeedClienteNovo {
  private readonly logger = new Logger(SeedClienteNovo.name);

  async execute(clienteId: string, tx: unknown): Promise<SeedClienteNovoResult> {
    const client = tx as TxClient;
    return {
      clientePlano: await this.seedClientePlano(client, clienteId),
      clienteQuotas: await this.seedClienteQuotas(client, clienteId),
      scoreConfig: await this.seedScoreConfig(client, clienteId),
      slaFocoConfig: await this.seedSlaFocoConfig(client, clienteId),
      slaFeriados: await this.seedSlaFeriados(client, clienteId),
      droneRiskConfig: await this.seedDroneRiskConfig(client, clienteId),
      yoloClassConfig: await this.seedYoloClassConfig(client, clienteId),
      yoloSynonyms: await this.seedYoloSynonyms(client, clienteId),
      planoAcaoCatalogo: await this.seedPlanoAcaoCatalogo(client, clienteId),
    };
  }

  // 1) cliente_plano: SELECT plano basico → INSERT (cliente_id, plano_id) ON CONFLICT (cliente_id) DO NOTHING
  private async seedClientePlano(
    tx: TxClient,
    clienteId: string,
  ): Promise<'criado' | 'pulado_sem_plano_basico' | 'ja_existente'> {
    const planoBasico = await tx.planos.findFirst({
      where: { nome: 'basico' },
      select: { id: true },
    });
    if (!planoBasico) {
      this.logger.warn(`Plano "basico" não cadastrado — cliente_plano não criado para ${clienteId}`);
      return 'pulado_sem_plano_basico';
    }

    const existente = await tx.cliente_plano.findUnique({
      where: { cliente_id: clienteId },
    });
    if (existente) return 'ja_existente';

    await tx.cliente_plano.create({
      data: { cliente_id: clienteId, plano_id: planoBasico.id },
    });
    return 'criado';
  }

  // 2) cliente_quotas: INSERT (cliente_id) ON CONFLICT (cliente_id) DO NOTHING
  private async seedClienteQuotas(
    tx: TxClient,
    clienteId: string,
  ): Promise<'criado' | 'ja_existente'> {
    const result = await tx.cliente_quotas.upsert({
      where: { cliente_id: clienteId },
      create: { cliente_id: clienteId },
      update: {},
      select: { created_at: true, updated_at: true },
    });
    const r = result as { created_at: Date; updated_at: Date };
    return r.created_at.getTime() === r.updated_at.getTime() ? 'criado' : 'ja_existente';
  }

  // 3) score_config: INSERT (cliente_id) ON CONFLICT (cliente_id) DO NOTHING (cliente_id é PK)
  private async seedScoreConfig(
    tx: TxClient,
    clienteId: string,
  ): Promise<'criado' | 'ja_existente'> {
    const result = await tx.score_config.upsert({
      where: { cliente_id: clienteId },
      create: { cliente_id: clienteId },
      update: {},
      select: { updated_at: true },
    });
    // Heurística: se updated_at é < 1s atrás é criação nova; cliente novo nunca terá score_config pré-existente.
    const r = result as { updated_at: Date };
    const ageMs = Date.now() - r.updated_at.getTime();
    return ageMs < 5000 ? 'criado' : 'ja_existente';
  }

  // 4) sla_foco_config: 4 fases (triagem=480, inspecao=720, confirmacao=1440, tratamento=2880)
  private async seedSlaFocoConfig(
    tx: TxClient,
    clienteId: string,
  ): Promise<{ criados: number }> {
    const result = await tx.sla_foco_config.createMany({
      data: SLA_FOCO_FASES.map((f) => ({
        cliente_id: clienteId,
        fase: f.fase,
        prazo_minutos: f.prazoMinutos,
      })),
      skipDuplicates: true,
    });
    return { criados: result.count };
  }

  // 5) sla_feriados: 20 feriados nacionais (2025-2026)
  private async seedSlaFeriados(
    tx: TxClient,
    clienteId: string,
  ): Promise<{ criados: number }> {
    const result = await tx.sla_feriados.createMany({
      data: SLA_FERIADOS_NACIONAIS.map((f) => ({
        cliente_id: clienteId,
        data: new Date(`${f.data}T00:00:00Z`),
        descricao: f.descricao,
        nacional: true,
      })),
      skipDuplicates: true,
    });
    return { criados: result.count };
  }

  // 6) sentinela_drone_risk_config: 1 linha com 4 JSONBs + confidence_multiplier
  private async seedDroneRiskConfig(
    tx: TxClient,
    clienteId: string,
  ): Promise<'criado' | 'ja_existente'> {
    const result = await tx.sentinela_drone_risk_config.upsert({
      where: { cliente_id: clienteId },
      create: {
        cliente_id: clienteId,
        base_by_risco: DRONE_BASE_BY_RISCO,
        priority_thresholds: DRONE_PRIORITY_THRESHOLDS,
        sla_by_priority_hours: DRONE_SLA_BY_PRIORITY_HOURS,
        confidence_multiplier: DRONE_CONFIDENCE_MULTIPLIER,
        item_overrides: DRONE_ITEM_OVERRIDES,
      },
      update: {},
      select: { created_at: true, updated_at: true },
    });
    const r = result as { created_at: Date; updated_at: Date };
    return r.created_at.getTime() === r.updated_at.getTime() ? 'criado' : 'ja_existente';
  }

  // 7a) sentinela_yolo_class_config: 8 classes
  private async seedYoloClassConfig(
    tx: TxClient,
    clienteId: string,
  ): Promise<{ criados: number }> {
    const result = await tx.sentinela_yolo_class_config.createMany({
      data: YOLO_CLASSES.map((c) => ({
        cliente_id: clienteId,
        item_key: c.itemKey,
        item: c.item,
        risco: c.risco,
        peso: c.peso,
        acao: c.acao,
      })),
      skipDuplicates: true,
    });
    return { criados: result.count };
  }

  // 7b) sentinela_yolo_synonym: 5 sinônimos
  private async seedYoloSynonyms(
    tx: TxClient,
    clienteId: string,
  ): Promise<{ criados: number }> {
    const result = await tx.sentinela_yolo_synonym.createMany({
      data: YOLO_SYNONYMS.map((s) => ({
        cliente_id: clienteId,
        synonym: s.synonym,
        maps_to: s.mapsTo,
      })),
      skipDuplicates: true,
    });
    return { criados: result.count };
  }

  // 8) plano_acao_catalogo: 10 genéricas (tipo_item NULL) + 12 por tipo
  // Idempotência: legado usa "IF NOT EXISTS" por (cliente_id, tipo_item NULL) e por (cliente_id, tipo_item=X).
  // Aqui usamos count() para os genéricos e WHERE/skipDuplicates não aplicável (não há unique).
  // Para preservar paridade, fazemos guard manual: se já existe alguma linha genérica, pula; idem por tipo.
  private async seedPlanoAcaoCatalogo(
    tx: TxClient,
    clienteId: string,
  ): Promise<{ genericosCriados: number; porTipoCriados: number }> {
    // Genéricos
    const jaTemGenericos = await tx.plano_acao_catalogo.count({
      where: { cliente_id: clienteId, tipo_item: null },
    });
    let genericosCriados = 0;
    if (jaTemGenericos === 0) {
      const r = await tx.plano_acao_catalogo.createMany({
        data: PLANO_ACAO_GENERICOS.map((a) => ({
          cliente_id: clienteId,
          label: a.label,
          descricao: a.descricao,
          tipo_item: null,
          ordem: a.ordem,
        })),
      });
      genericosCriados = r.count;
    }

    // Por tipo: cada tipo verificado individualmente
    let porTipoCriados = 0;
    for (const acao of PLANO_ACAO_POR_TIPO) {
      const jaTem = await tx.plano_acao_catalogo.count({
        where: { cliente_id: clienteId, tipo_item: acao.tipoItem },
      });
      if (jaTem === 0) {
        const r = await tx.plano_acao_catalogo.createMany({
          data: [
            {
              cliente_id: clienteId,
              label: acao.label,
              descricao: acao.descricao,
              tipo_item: acao.tipoItem,
              ordem: acao.ordem,
            },
          ],
        });
        porTipoCriados += r.count;
      }
    }

    return { genericosCriados, porTipoCriados };
  }
}
