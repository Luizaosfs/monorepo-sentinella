import { SeedClienteNovo } from '../seed-cliente-novo';

const CLIENTE_ID = '00000000-0000-4000-8000-000000000001';
const PLANO_BASICO_ID = '00000000-0000-4000-8000-0000000000aa';

function makeTx() {
  return {
    planos: { findFirst: jest.fn() },
    cliente_plano: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    cliente_quotas: { upsert: jest.fn() },
    score_config: { upsert: jest.fn() },
    sla_foco_config: { createMany: jest.fn() },
    sla_feriados: { createMany: jest.fn() },
    sentinela_drone_risk_config: { upsert: jest.fn() },
    sentinela_yolo_class_config: { createMany: jest.fn() },
    sentinela_yolo_synonym: { createMany: jest.fn() },
    plano_acao_catalogo: {
      count: jest.fn(),
      createMany: jest.fn(),
    },
  };
}

function setupHappyPath(tx: ReturnType<typeof makeTx>) {
  tx.planos.findFirst.mockResolvedValue({ id: PLANO_BASICO_ID });
  tx.cliente_plano.findUnique.mockResolvedValue(null);
  tx.cliente_plano.create.mockResolvedValue({ id: 'cp-1' });
  const now = new Date();
  tx.cliente_quotas.upsert.mockResolvedValue({ created_at: now, updated_at: now });
  tx.score_config.upsert.mockResolvedValue({ updated_at: now });
  tx.sla_foco_config.createMany.mockResolvedValue({ count: 4 });
  tx.sla_feriados.createMany.mockResolvedValue({ count: 20 });
  tx.sentinela_drone_risk_config.upsert.mockResolvedValue({ created_at: now, updated_at: now });
  tx.sentinela_yolo_class_config.createMany.mockResolvedValue({ count: 8 });
  tx.sentinela_yolo_synonym.createMany.mockResolvedValue({ count: 5 });
  tx.plano_acao_catalogo.count.mockResolvedValue(0);
  tx.plano_acao_catalogo.createMany.mockResolvedValue({ count: 1 });
}

describe('SeedClienteNovo', () => {
  let useCase: SeedClienteNovo;
  let tx: ReturnType<typeof makeTx>;

  beforeEach(() => {
    useCase = new SeedClienteNovo();
    tx = makeTx();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────
  it('deve semear todas as 9 áreas no happy path', async () => {
    setupHappyPath(tx);

    const result = await useCase.execute(CLIENTE_ID, tx);

    expect(result.clientePlano).toBe('criado');
    expect(result.clienteQuotas).toBe('criado');
    expect(result.scoreConfig).toBe('criado');
    expect(result.slaFocoConfig.criados).toBe(4);
    expect(result.slaFeriados.criados).toBe(20);
    expect(result.droneRiskConfig).toBe('criado');
    expect(result.yoloClassConfig.criados).toBe(8);
    expect(result.yoloSynonyms.criados).toBe(5);
    // 10 genéricos pulados em batch + 12 por tipo (cada um chamando createMany se count=0)
    expect(result.planoAcaoCatalogo.genericosCriados).toBe(1); // mock retorna 1 sempre — cobrir invocação
    expect(result.planoAcaoCatalogo.porTipoCriados).toBe(12);
  });

  // ── 1) cliente_plano ───────────────────────────────────────────────────────
  describe('cliente_plano', () => {
    it('busca plano "basico" e cria cliente_plano com plano_id resolvido', async () => {
      setupHappyPath(tx);
      await useCase.execute(CLIENTE_ID, tx);

      expect(tx.planos.findFirst).toHaveBeenCalledWith({
        where: { nome: 'basico' },
        select: { id: true },
      });
      expect(tx.cliente_plano.create).toHaveBeenCalledWith({
        data: { cliente_id: CLIENTE_ID, plano_id: PLANO_BASICO_ID },
      });
    });

    it('retorna "pulado_sem_plano_basico" se plano "basico" não existir', async () => {
      setupHappyPath(tx);
      tx.planos.findFirst.mockResolvedValue(null);

      const result = await useCase.execute(CLIENTE_ID, tx);

      expect(result.clientePlano).toBe('pulado_sem_plano_basico');
      expect(tx.cliente_plano.create).not.toHaveBeenCalled();
    });

    it('retorna "ja_existente" se cliente_plano já existir (idempotência)', async () => {
      setupHappyPath(tx);
      tx.cliente_plano.findUnique.mockResolvedValue({ id: 'existente' });

      const result = await useCase.execute(CLIENTE_ID, tx);

      expect(result.clientePlano).toBe('ja_existente');
      expect(tx.cliente_plano.create).not.toHaveBeenCalled();
    });
  });

  // ── 4) sla_foco_config ─────────────────────────────────────────────────────
  describe('sla_foco_config', () => {
    it('cria as 4 fases com prazos corretos (paridade com fn_seed_sla_foco_config)', async () => {
      setupHappyPath(tx);
      await useCase.execute(CLIENTE_ID, tx);

      expect(tx.sla_foco_config.createMany).toHaveBeenCalledWith({
        data: [
          { cliente_id: CLIENTE_ID, fase: 'triagem', prazo_minutos: 480 },
          { cliente_id: CLIENTE_ID, fase: 'inspecao', prazo_minutos: 720 },
          { cliente_id: CLIENTE_ID, fase: 'confirmacao', prazo_minutos: 1440 },
          { cliente_id: CLIENTE_ID, fase: 'tratamento', prazo_minutos: 2880 },
        ],
        skipDuplicates: true,
      });
    });
  });

  // ── 5) sla_feriados ────────────────────────────────────────────────────────
  describe('sla_feriados', () => {
    it('cria 20 feriados nacionais com nacional=true', async () => {
      setupHappyPath(tx);
      await useCase.execute(CLIENTE_ID, tx);

      const call = tx.sla_feriados.createMany.mock.calls[0][0] as {
        data: Array<{ cliente_id: string; data: Date; descricao: string; nacional: boolean }>;
        skipDuplicates: boolean;
      };
      expect(call.data).toHaveLength(20);
      expect(call.skipDuplicates).toBe(true);
      expect(call.data.every((f) => f.cliente_id === CLIENTE_ID)).toBe(true);
      expect(call.data.every((f) => f.nacional === true)).toBe(true);
      // Confraternização deve estar nos 2 anos
      const confraternizacao = call.data.filter((f) => f.descricao === 'Confraternização Universal');
      expect(confraternizacao).toHaveLength(2);
    });

    it('preserva timezone UTC nos feriados (Date com Z)', async () => {
      setupHappyPath(tx);
      await useCase.execute(CLIENTE_ID, tx);

      const call = tx.sla_feriados.createMany.mock.calls[0][0] as {
        data: Array<{ data: Date }>;
      };
      const primeiro = call.data[0];
      expect(primeiro.data.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  // ── 6) sentinela_drone_risk_config ─────────────────────────────────────────
  describe('drone_risk_config', () => {
    it('cria config com 4 JSONBs do legado seed_drone_risk_config', async () => {
      setupHappyPath(tx);
      await useCase.execute(CLIENTE_ID, tx);

      expect(tx.sentinela_drone_risk_config.upsert).toHaveBeenCalledWith({
        where: { cliente_id: CLIENTE_ID },
        create: {
          cliente_id: CLIENTE_ID,
          base_by_risco: { baixo: 25, medio: 55, alto: 85 },
          priority_thresholds: { P1: 85, P2: 60, P3: 40, P4: 20, P5: 0 },
          sla_by_priority_hours: { P1: 24, P2: 72, P3: 168, P4: 336, P5: 720 },
          confidence_multiplier: 1.0,
          item_overrides: {
            caixa_dagua_aberta: { min_score: 90, force_priority: 'P1' },
            pneu: { min_score: 85 },
            tambor: { min_score: 80 },
            calha_suja: { min_score: 60 },
            entulho: { min_score: 55 },
          },
        },
        update: {},
        select: { created_at: true, updated_at: true },
      });
    });
  });

  // ── 7) yolo class + synonyms ───────────────────────────────────────────────
  describe('yolo_class_config + yolo_synonym', () => {
    it('cria 8 classes YOLO do legado', async () => {
      setupHappyPath(tx);
      await useCase.execute(CLIENTE_ID, tx);

      const call = tx.sentinela_yolo_class_config.createMany.mock.calls[0][0] as {
        data: Array<{ item_key: string }>;
        skipDuplicates: boolean;
      };
      expect(call.data).toHaveLength(8);
      expect(call.skipDuplicates).toBe(true);
      const keys = call.data.map((c) => c.item_key);
      expect(keys).toEqual([
        'pneu',
        'tambor',
        'caixa_dagua',
        'caixa_dagua_aberta',
        'calha_suja',
        'entulho',
        'piscina_suja_verde',
        'agua_piscina_verde',
      ]);
    });

    it('cria 5 sinônimos YOLO do legado', async () => {
      setupHappyPath(tx);
      await useCase.execute(CLIENTE_ID, tx);

      const call = tx.sentinela_yolo_synonym.createMany.mock.calls[0][0] as {
        data: Array<{ synonym: string; maps_to: string }>;
      };
      expect(call.data).toHaveLength(5);
      expect(call.data.find((s) => s.synonym === 'caixa_agua_aberta')?.maps_to).toBe('caixa_dagua_aberta');
      expect(call.data.find((s) => s.synonym === 'pneu_velho')?.maps_to).toBe('pneu');
    });
  });

  // ── 8) plano_acao_catalogo ─────────────────────────────────────────────────
  describe('plano_acao_catalogo', () => {
    it('cria 10 genéricos quando count(tipo_item NULL) = 0', async () => {
      setupHappyPath(tx);
      await useCase.execute(CLIENTE_ID, tx);

      // Primeira chamada de createMany (genéricos)
      const primeiraChamada = tx.plano_acao_catalogo.createMany.mock.calls[0][0] as {
        data: Array<{ tipo_item: string | null; ordem: number }>;
      };
      expect(primeiraChamada.data).toHaveLength(10);
      expect(primeiraChamada.data.every((a) => a.tipo_item === null)).toBe(true);
      expect(primeiraChamada.data.map((a) => a.ordem)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('pula genéricos se count(tipo_item NULL) > 0 (idempotência)', async () => {
      setupHappyPath(tx);
      // Primeira chamada (genéricos) retorna 5 → pula. Demais chamadas retornam 0.
      tx.plano_acao_catalogo.count
        .mockResolvedValueOnce(5)
        .mockResolvedValue(0);

      const result = await useCase.execute(CLIENTE_ID, tx);

      expect(result.planoAcaoCatalogo.genericosCriados).toBe(0);
      // Apenas 12 chamadas (uma por tipo) — sem chamada de genéricos
      expect(tx.plano_acao_catalogo.createMany).toHaveBeenCalledTimes(12);
    });

    it('cria as 12 ações por tipo quando count = 0 para cada um', async () => {
      setupHappyPath(tx);

      const result = await useCase.execute(CLIENTE_ID, tx);

      expect(result.planoAcaoCatalogo.porTipoCriados).toBe(12);
      // count chamado 13 vezes: 1 para genéricos + 12 para tipos
      expect(tx.plano_acao_catalogo.count).toHaveBeenCalledTimes(13);
    });

    it('pula ação por tipo se count(tipo_item=X) > 0', async () => {
      setupHappyPath(tx);
      // Genéricos = 0, primeiro tipo (pneu) = 3, demais = 0
      tx.plano_acao_catalogo.count
        .mockResolvedValueOnce(0) // genéricos
        .mockResolvedValueOnce(3) // pneu (já existe)
        .mockResolvedValue(0); // demais 11 tipos

      const result = await useCase.execute(CLIENTE_ID, tx);

      // 1 (genéricos) + 11 (demais tipos) = 12 chamadas createMany
      expect(tx.plano_acao_catalogo.createMany).toHaveBeenCalledTimes(12);
      expect(result.planoAcaoCatalogo.porTipoCriados).toBe(11);
    });
  });

  // ── Atomicidade: erro propaga ──────────────────────────────────────────────
  describe('atomicidade', () => {
    it('propaga erro de qualquer seed (não engole)', async () => {
      setupHappyPath(tx);
      tx.sla_foco_config.createMany.mockRejectedValue(new Error('DB constraint'));

      await expect(useCase.execute(CLIENTE_ID, tx)).rejects.toThrow('DB constraint');
    });

    it('propaga erro do plano findFirst', async () => {
      tx.planos.findFirst.mockRejectedValue(new Error('connection lost'));

      await expect(useCase.execute(CLIENTE_ID, tx)).rejects.toThrow('connection lost');
    });
  });
});
