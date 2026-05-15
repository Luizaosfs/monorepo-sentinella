import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { criarRunComItensSchema } from '../../dtos/criar-run-com-itens.body';
import { CriarRunComItens } from '../criar-run-com-itens';

const CLIENTE_GUARD = '2e3f32f3-f8bf-433b-9839-553f7f1ce2d8';

function buildPrismaMock() {
  const runCreate = jest.fn().mockResolvedValue({ id: 'run-1' });
  const itemCreateMany = jest.fn().mockResolvedValue({ count: 0 });
  const tx = {
    pluvio_operacional_run: { create: runCreate },
    pluvio_operacional_item: { createMany: itemCreateMany },
  };
  const $transaction = jest.fn((cb: (t: typeof tx) => unknown) => cb(tx));
  return {
    prisma: { client: { $transaction } } as unknown as PrismaService,
    runCreate,
    itemCreateMany,
    $transaction,
  };
}

async function build(prisma: PrismaService) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [CriarRunComItens, { provide: PrismaService, useValue: prisma }],
  }).compile();
  return module.get<CriarRunComItens>(CriarRunComItens);
}

describe('CriarRunComItens', () => {
  it('cria run + itens na mesma transação e usa o cliente do guard (MT-02)', async () => {
    const m = buildPrismaMock();
    const uc = await build(m.prisma);

    const parsed = criarRunComItensSchema.parse({
      clienteId: '00000000-0000-0000-0000-000000000000', // deve ser ignorado
      dtRef: '2026-05-15',
      itens: [
        {
          bairro_nome: 'Centro',
          classificacao_risco: 'Alto',
          chuva_24h_mm: '55.0',
          prob_final_min: 65,
          prob_final_max: 85,
          prioridade_operacional: 'Urgente',
        },
        { bairro_nome: 'Jardim', chuva_24h_mm: '' },
      ],
    });

    const res = await uc.execute(parsed, CLIENTE_GUARD);

    expect(m.$transaction).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ id: 'run-1', total: 2 });

    // run usa cliente do guard, NÃO o do body, e dt_ref é Date (Prisma 7)
    const runArg = m.runCreate.mock.calls[0][0].data;
    expect(runArg.cliente_id).toBe(CLIENTE_GUARD);
    expect(runArg.total_bairros).toBe(2);
    expect(runArg.dt_ref).toBeInstanceOf(Date);

    const rows = m.itemCreateMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      run_id: 'run-1',
      bairro_nome: 'Centro',
      classificacao_risco: 'Alto',
      chuva_24h_mm: 55,
      prob_final_min: 65,
      prob_final_max: 85,
      prioridade_operacional: 'Urgente',
    });
    // defaults dos NOT NULL + '' numérico → null
    expect(rows[1]).toMatchObject({
      bairro_nome: 'Jardim',
      classificacao_risco: 'Baixo',
      prioridade_operacional: 'Monitoramento',
      chuva_24h_mm: null,
    });
  });

  it('respeita totalBairros explícito quando informado', async () => {
    const m = buildPrismaMock();
    const uc = await build(m.prisma);

    const parsed = criarRunComItensSchema.parse({
      dtRef: '2026-05-15',
      totalBairros: 99,
      itens: [{ bairro_nome: 'X' }],
    });

    const res = await uc.execute(parsed, CLIENTE_GUARD);
    expect(res.total).toBe(99);
    expect(m.runCreate.mock.calls[0][0].data.total_bairros).toBe(99);
  });
});
