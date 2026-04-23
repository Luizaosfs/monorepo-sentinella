import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { BackfillConsolidacaoService } from '@modules/vistoria/services/backfill-consolidacao.service';
import { E2E_CLIENTE_ID } from './auth-helpers';

const skipE2e = process.env.SKIP_E2E === '1';

(skipE2e ? describe.skip : describe)(
  'BackfillConsolidacaoService (e2e)',
  () => {
    let app: INestApplication;
    let prisma: PrismaClient;
    let pool: Pool;
    let backfillService: BackfillConsolidacaoService;

    const AGENTE_ID = '00000000-0000-4000-8000-000000000030';
    const createdIds: string[] = [];

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

      backfillService = app.get(BackfillConsolidacaoService);
    }, 120_000);

    afterAll(async () => {
      if (app) await app.close();
      if (prisma) await prisma.$disconnect();
    });

    afterEach(async () => {
      if (createdIds.length === 0) return;
      await prisma.vistoria_consolidacao_historico.deleteMany({
        where: { vistoria_id: { in: createdIds } },
      });
      await prisma.vistorias.deleteMany({
        where: { id: { in: createdIds } },
      });
      createdIds.length = 0;
    });

    async function criarVistoriaSemConsolidacao(): Promise<string> {
      const v = await prisma.vistorias.create({
        data: {
          cliente_id: E2E_CLIENTE_ID,
          agente_id: AGENTE_ID,
          ciclo: 1,
          tipo_atividade: 'LI',
          data_visita: new Date(),
          status: 'concluida',
          gravidas: false,
          idosos: false,
          criancas_7anos: false,
          acesso_realizado: false,
          pendente_assinatura: false,
          pendente_foto: false,
          origem_offline: false,
          consolidacao_incompleta: false,
          // consolidado_em propositalmente null — candidata para backfill
        },
      });
      createdIds.push(v.id);
      return v.id;
    }

    it('backfill consolida todas as vistorias sem consolidado_em', async () => {
      const [id1, id2, id3] = await Promise.all([
        criarVistoriaSemConsolidacao(),
        criarVistoriaSemConsolidacao(),
        criarVistoriaSemConsolidacao(),
      ]);

      const result = await backfillService.executar({ loteSize: 2 });

      expect(result.erros).toBe(0);
      expect(result.ok).toBeGreaterThanOrEqual(3);

      const [v1, v2, v3] = await Promise.all([
        prisma.vistorias.findUnique({ where: { id: id1 } }),
        prisma.vistorias.findUnique({ where: { id: id2 } }),
        prisma.vistorias.findUnique({ where: { id: id3 } }),
      ]);

      expect(v1?.consolidado_em).not.toBeNull();
      expect(v2?.consolidado_em).not.toBeNull();
      expect(v3?.consolidado_em).not.toBeNull();
      expect(v1?.prioridade_final).toMatch(/^P[1-5]$/);
    });

    it('re-executar o backfill é idempotente — total=0 após consolidação completa', async () => {
      const id = await criarVistoriaSemConsolidacao();

      await backfillService.executar({ loteSize: 10 });

      const v = await prisma.vistorias.findUnique({ where: { id } });
      expect(v?.consolidado_em).not.toBeNull();

      // Segunda execução: sem candidatas
      const result2 = await backfillService.executar({ loteSize: 10 });
      expect(result2.total).toBe(0);
      expect(result2.processadas).toBe(0);
    });

    it('dryRun=true conta candidatas sem consolidar', async () => {
      await criarVistoriaSemConsolidacao();

      const result = await backfillService.executar({ dryRun: true });

      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.processadas).toBe(0);

      const v = await prisma.vistorias.findUnique({ where: { id: createdIds[0] } });
      expect(v?.consolidado_em).toBeNull();
    });
  },
);
