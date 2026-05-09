import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { gerarLoteQuarteiraoSchema } from '../../dtos/gerar-lote-quarteiroes.body';
import { GerarLoteQuarteiroes } from '../gerar-lote-quarteiroes';

// ── Constants ─────────────────────────────────────────────────────────────────

const CLIENTE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REGIAO_ID  = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeUc(overrides: {
  regiaoFindFirst?: jest.Mock;
  quarteiroFindMany?: jest.Mock;
  quarteiroCreateMany?: jest.Mock;
} = {}) {
  const regiaoFindFirst    = overrides.regiaoFindFirst    ?? jest.fn().mockResolvedValue({ id: REGIAO_ID });
  const quarteiroFindMany  = overrides.quarteiroFindMany  ?? jest.fn().mockResolvedValue([]);
  const quarteiroCreateMany = overrides.quarteiroCreateMany ?? jest.fn().mockResolvedValue({ count: 0 });

  // tx client passed to the $transaction callback — has quarteiroes methods
  const txClient = {
    quarteiroes: { findMany: quarteiroFindMany, createMany: quarteiroCreateMany },
  };

  const prisma = {
    client: {
      regioes:      { findFirst: regiaoFindFirst },
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof txClient) => unknown) => fn(txClient)),
    },
  };

  return {
    uc: new GerarLoteQuarteiroes(prisma as never),
    regiaoFindFirst,
    quarteiroFindMany,
    quarteiroCreateMany,
  };
}

// ── Schema (DTO) tests ────────────────────────────────────────────────────────

describe('gerarLoteQuarteiraoSchema', () => {
  it('normaliza prefixo com espaços e minúsculas → uppercase sem espaços', () => {
    const result = gerarLoteQuarteiraoSchema.parse({
      regiaoId: REGIAO_ID,
      prefixo: '  abc  ',
      numeroInicial: 1,
      numeroFinal: 3,
    });
    expect(result.prefixo).toBe('ABC');
  });

  it('rejeita prefixo com caracteres inválidos', () => {
    expect(() =>
      gerarLoteQuarteiraoSchema.parse({
        regiaoId: REGIAO_ID,
        prefixo: 'A!B',
        numeroInicial: 1,
        numeroFinal: 3,
      }),
    ).toThrow();
  });

  it('rejeita prefixo com espaço interno', () => {
    expect(() =>
      gerarLoteQuarteiraoSchema.parse({
        regiaoId: REGIAO_ID,
        prefixo: 'A B',
        numeroInicial: 1,
        numeroFinal: 3,
      }),
    ).toThrow();
  });

  it('rejeita lote acima de 300', () => {
    expect(() =>
      gerarLoteQuarteiraoSchema.parse({
        regiaoId: REGIAO_ID,
        prefixo: 'A',
        numeroInicial: 1,
        numeroFinal: 301,
      }),
    ).toThrow();
  });

  it('aceita lote exato de 300', () => {
    const result = gerarLoteQuarteiraoSchema.parse({
      regiaoId: REGIAO_ID,
      prefixo: 'A',
      numeroInicial: 1,
      numeroFinal: 300,
    });
    expect(result.numeroFinal - result.numeroInicial + 1).toBe(300);
  });

  it('rejeita numeroFinal < numeroInicial', () => {
    expect(() =>
      gerarLoteQuarteiraoSchema.parse({
        regiaoId: REGIAO_ID,
        prefixo: 'A',
        numeroInicial: 5,
        numeroFinal: 3,
      }),
    ).toThrow();
  });

  it('rejeita numeroInicial < 1', () => {
    expect(() =>
      gerarLoteQuarteiraoSchema.parse({
        regiaoId: REGIAO_ID,
        prefixo: 'A',
        numeroInicial: 0,
        numeroFinal: 5,
      }),
    ).toThrow();
  });

  it('rejeita regiaoId inválido (não UUID)', () => {
    expect(() =>
      gerarLoteQuarteiraoSchema.parse({
        regiaoId: 'nao-e-uuid',
        prefixo: 'A',
        numeroInicial: 1,
        numeroFinal: 5,
      }),
    ).toThrow();
  });
});

// ── Use-case tests ────────────────────────────────────────────────────────────

describe('GerarLoteQuarteiroes', () => {
  it('gera A1 até A30 com códigos e contagens corretas', async () => {
    const { uc, quarteiroCreateMany } = makeUc({
      quarteiroCreateMany: jest.fn().mockResolvedValue({ count: 30 }),
    });

    const result = await uc.execute(CLIENTE_ID, {
      regiaoId: REGIAO_ID,
      prefixo: 'A',
      numeroInicial: 1,
      numeroFinal: 30,
    });

    expect(result.totalSolicitado).toBe(30);
    expect(result.totalCriado).toBe(30);
    expect(result.totalIgnorado).toBe(0);
    expect(result.criados).toHaveLength(30);
    expect(result.criados[0]).toBe('A1');
    expect(result.criados[29]).toBe('A30');
    expect(quarteiroCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ codigo: 'A1', cliente_id: CLIENTE_ID, regiao_id: REGIAO_ID, ativo: true }),
          expect.objectContaining({ codigo: 'A30' }),
        ]),
        skipDuplicates: true,
      }),
    );
  });

  it('ignora códigos pré-existentes e reflete na lista ignorados', async () => {
    const { uc } = makeUc({
      quarteiroFindMany:  jest.fn().mockResolvedValue([{ codigo: 'B2' }]),
      quarteiroCreateMany: jest.fn().mockResolvedValue({ count: 2 }),
    });

    const result = await uc.execute(CLIENTE_ID, {
      regiaoId: REGIAO_ID,
      prefixo: 'B',
      numeroInicial: 1,
      numeroFinal: 3,
    });

    expect(result.criados).toEqual(['B1', 'B3']);
    expect(result.ignorados).toEqual([{ codigo: 'B2', motivo: 'Já existente' }]);
    expect(result.totalSolicitado).toBe(3);
    expect(result.totalCriado).toBe(2);
    expect(result.totalIgnorado).toBe(1);
  });

  it('não chama createMany quando todos os códigos já existem', async () => {
    const { uc, quarteiroCreateMany } = makeUc({
      quarteiroFindMany: jest.fn().mockResolvedValue([{ codigo: 'C1' }, { codigo: 'C2' }]),
    });

    const result = await uc.execute(CLIENTE_ID, {
      regiaoId: REGIAO_ID,
      prefixo: 'C',
      numeroInicial: 1,
      numeroFinal: 2,
    });

    expect(result.totalCriado).toBe(0);
    expect(result.totalIgnorado).toBe(2);
    expect(quarteiroCreateMany).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando região não pertence ao tenant', async () => {
    const { uc } = makeUc({
      regiaoFindFirst: jest.fn().mockResolvedValue(null),
    });

    await expect(
      uc.execute(CLIENTE_ID, { regiaoId: REGIAO_ID, prefixo: 'D', numeroInicial: 1, numeroFinal: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('garante que o clienteId vem do tenant, não do payload, ao criar e verificar duplicatas', async () => {
    const { uc, quarteiroFindMany, quarteiroCreateMany } = makeUc({
      quarteiroCreateMany: jest.fn().mockResolvedValue({ count: 2 }),
    });

    await uc.execute(CLIENTE_ID, { regiaoId: REGIAO_ID, prefixo: 'E', numeroInicial: 1, numeroFinal: 2 });

    expect(quarteiroFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cliente_id: CLIENTE_ID }) }),
    );
    expect(quarteiroCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ cliente_id: CLIENTE_ID }),
        ]),
      }),
    );
  });

  it('normaliza prefixo defensivamente no use-case (trim + uppercase)', async () => {
    const { uc } = makeUc({
      quarteiroCreateMany: jest.fn().mockResolvedValue({ count: 2 }),
    });

    const result = await uc.execute(CLIENTE_ID, {
      regiaoId: REGIAO_ID,
      prefixo: '  xy  ', // simula entrada não normalizada chegando diretamente ao use-case
      numeroInicial: 1,
      numeroFinal: 2,
    });

    expect(result.criados).toEqual(['XY1', 'XY2']);
  });

  it('trata P2002 como ignorado sem derrubar a operação', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('duplicate key', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['cliente_id_codigo_key'] },
    });

    const { uc } = makeUc({
      quarteiroCreateMany: jest.fn().mockRejectedValue(p2002),
    });

    const result = await uc.execute(CLIENTE_ID, {
      regiaoId: REGIAO_ID,
      prefixo: 'F',
      numeroInicial: 1,
      numeroFinal: 2,
    });

    expect(result.totalCriado).toBe(0);
    expect(result.totalIgnorado).toBe(2);
    expect(result.criados).toHaveLength(0);
    expect(result.ignorados).toHaveLength(2);
    expect(result.ignorados[0].motivo).toBe('Conflito de concorrência');
  });

  it('relança erros que não sejam P2002', async () => {
    const { uc } = makeUc({
      quarteiroCreateMany: jest.fn().mockRejectedValue(new Error('DB unavailable')),
    });

    await expect(
      uc.execute(CLIENTE_ID, { regiaoId: REGIAO_ID, prefixo: 'G', numeroInicial: 1, numeroFinal: 2 }),
    ).rejects.toThrow('DB unavailable');
  });

  it('detecta race condition (count < toCreate) e identifica stragglers pelo re-query', async () => {
    // First findMany call: no pre-existing; second call (re-query): confirms only H1 was created
    const quarteiroFindMany = jest
      .fn()
      .mockResolvedValueOnce([])                // duplicate pre-check → none existing
      .mockResolvedValueOnce([{ codigo: 'H1' }]); // re-query after race → only H1 confirmed

    const { uc } = makeUc({
      quarteiroFindMany,
      quarteiroCreateMany: jest.fn().mockResolvedValue({ count: 1 }), // only 1 of 2 created
    });

    const result = await uc.execute(CLIENTE_ID, {
      regiaoId: REGIAO_ID,
      prefixo: 'H',
      numeroInicial: 1,
      numeroFinal: 2,
    });

    expect(result.totalSolicitado).toBe(2);
    expect(result.totalCriado).toBe(1);
    expect(result.criados).toEqual(['H1']);
    expect(result.ignorados).toEqual([{ codigo: 'H2', motivo: 'Conflito de concorrência' }]);
  });
});
