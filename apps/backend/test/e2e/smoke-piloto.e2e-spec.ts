import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import request = require('supertest');

import {
  AGENTE_AUTH_ID,
  AGENTE_USUARIO_ID,
  E2E_CLIENTE_ID,
  SUPERVISOR_AUTH_ID,
  SUPERVISOR_USUARIO_ID,
  signTokenFor,
} from './auth-helpers';

const skipE2e = process.env.SKIP_E2E === '1';

(skipE2e ? describe.skip : describe)('Smoke Piloto — fluxo crítico do agente (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let pool: Pool;

  let focoId: string;

  beforeAll(async () => {
    const { AppModule } = await import('@/app.module');
    const { MyZodValidationPipe } = await import('@/pipes/zod-validations.pipe');
    const { GlobalExceptionFilter } = await import(
      '@/common/filters/global-exception.filter'
    );

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new MyZodValidationPipe());
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({
      adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    });
  }, 120_000);

  afterAll(async () => {
    if (prisma && focoId) {
      await prisma.foco_risco_historico.deleteMany({ where: { foco_risco_id: focoId } }).catch(() => null);
      await prisma.sla_operacional.deleteMany({ where: { foco_risco_id: focoId } }).catch(() => null);
      await prisma.focos_risco.deleteMany({ where: { id: focoId } }).catch(() => null);
    }
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  // ─── Passo 1: Health endpoint acessível ────────────────────────────────
  it('P1 — GET /health retorna 200 com status ok', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(['ok', 'degraded']).toContain(res.body.db);
  });

  // ─── Passo 2: JWT supervisor válido (auth chain funcionando) ───────────
  it('P2 — supervisor autenticado acessa GET /focos-risco (auth+roles+tenant ok)', async () => {
    const token = signTokenFor(SUPERVISOR_AUTH_ID);
    const res = await request(app.getHttpServer())
      .get('/focos-risco')
      .set('Authorization', `Bearer ${token}`)
      .query({ clienteId: E2E_CLIENTE_ID });
    expect(res.status).toBe(200);
  });

  // ─── Passo 3: Criar foco (seed direto — testa auto hooks de historico) ─
  it('P3 — foco em suspeita criado no banco de teste', async () => {
    focoId = randomUUID();
    await prisma.focos_risco.create({
      data: {
        id: focoId,
        cliente_id: E2E_CLIENTE_ID,
        origem_tipo: 'agente',
        status: 'suspeita',
        classificacao_inicial: 'suspeito',
        prioridade: 'P3',
        latitude: -20.5,
        longitude: -51.0,
      },
    });
    const foco = await prisma.focos_risco.findUnique({ where: { id: focoId } });
    expect(foco).not.toBeNull();
    expect(foco?.status).toBe('suspeita');
  });

  // ─── Passo 4: Agente vê o foco (escopo municipal correto) ──────────────
  it('P4 — agente autenticado acessa GET /focos-risco e encontra o foco criado', async () => {
    const agenteToken = signTokenFor(AGENTE_AUTH_ID);
    const res = await request(app.getHttpServer())
      .get('/focos-risco')
      .set('Authorization', `Bearer ${agenteToken}`);
    expect(res.status).toBe(200);
    const body = Array.isArray(res.body) ? res.body : (res.body?.data ?? []);
    const found = body.find((f: { id: string }) => f.id === focoId);
    expect(found).toBeDefined();
  });

  // ─── Passo 5: Supervisor transiciona suspeita → em_triagem via HTTP ────
  it('P5 — supervisor transiciona foco suspeita → em_triagem (state machine)', async () => {
    const supervisorToken = signTokenFor(SUPERVISOR_AUTH_ID);
    const res = await request(app.getHttpServer())
      .post(`/focos-risco/${focoId}/transicionar`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ novoStatus: 'em_triagem' });
    expect(res.status).toBe(200);

    const foco = await prisma.focos_risco.findUnique({ where: { id: focoId } });
    expect(foco?.status).toBe('em_triagem');
  });

  // ─── Passo 6: Histórico foi criado (append-only, tipo TRANSICAO) ───────
  it('P6 — historico de TRANSICAO criado para a triagem', async () => {
    const hist = await prisma.foco_risco_historico.findMany({
      where: { foco_risco_id: focoId, tipo_evento: 'TRANSICAO' },
    });
    expect(hist.length).toBeGreaterThanOrEqual(1);
    const transicao = hist[0];
    expect(transicao.status_anterior).toBe('suspeita');
    expect(transicao.status_novo).toBe('em_triagem');
    expect(transicao.cliente_id).toBe(E2E_CLIENTE_ID);
  });

  // ─── Passo 7: created_by / alterado_por populados (CLS extension) ──────
  it('P7 — alterado_por no historico é o ID do supervisor (CLS extension ativo)', async () => {
    const hist = await prisma.foco_risco_historico.findFirst({
      where: { foco_risco_id: focoId, tipo_evento: 'TRANSICAO' },
    });
    expect(hist).not.toBeNull();
    // Se alterado_por for null, o CLS extension não está propagando o user.id.
    expect(hist?.alterado_por).toBe(SUPERVISOR_USUARIO_ID);
  });

  // ─── Passo 8: 401 sem token (guard chain ativo) ────────────────────────
  it('P8 — GET /focos-risco sem token retorna 401', async () => {
    const res = await request(app.getHttpServer()).get('/focos-risco');
    expect(res.status).toBe(401);
  });

  // ─── Passo 9: 403 agente tentando transsicionar (RolesGuard ativo) ──────
  it('P9 — agente não pode transsicionar foco (RolesGuard rejeita papel errado)', async () => {
    // Transicionar é @Roles('admin','supervisor') — agente deve receber 403.
    const agenteToken = signTokenFor(AGENTE_AUTH_ID);
    const res = await request(app.getHttpServer())
      .post(`/focos-risco/${focoId}/transicionar`)
      .set('Authorization', `Bearer ${agenteToken}`)
      .send({ novoStatus: 'aguarda_inspecao' });
    expect(res.status).toBe(403);
  });
});
