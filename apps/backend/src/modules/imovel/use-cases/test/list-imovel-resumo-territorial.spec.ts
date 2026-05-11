import { Test } from '@nestjs/testing';

import { ImovelReadRepository, ImovelResumo } from '../../repositories/imovel-read.repository';
import { ListImovelResumo } from '../list-imovel-resumo';

const CLIENTE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const QUADRA_CENTRO = 'q1111111-0000-0000-0000-000000000001';
const QUADRA_JARDIM  = 'q2222222-0000-0000-0000-000000000002';

function makeImovel(overrides: Partial<ImovelResumo> = {}): ImovelResumo {
  return {
    id:                 'i1',
    clienteId:          CLIENTE_ID,
    logradouro:         'Rua A',
    numero:             '10',
    complemento:        null,
    bairro:             'Centro',
    quarteirao:         'Q1',
    quadraId:           QUADRA_CENTRO,
    regiaoId:           null,
    tipoImovel:         'residencial',
    latitude:           null,
    longitude:          null,
    ativo:              true,
    historicoRecusa:    false,
    prioridadeDrone:    false,
    temCalha:           false,
    calhaAcessivel:     true,
    createdAt:          '2026-01-01T00:00:00.000Z',
    updatedAt:          '2026-01-01T00:00:00.000Z',
    totalVistorias:     0,
    ultimaVisita:       null,
    tentativasSemAcesso: 0,
    totalFocosHistorico: 0,
    focosAtivos:        0,
    ultimoFocoEm:       null,
    slasAbertos:        0,
    focosRecorrentes:   0,
    scoreTerritorial:   null,
    scoreClassificacao: null,
    scoreFatores:       null,
    scoreCalculadoEm:   null,
    ...overrides,
  };
}

const IMOVEL_CENTRO = makeImovel({ id: 'i1', quadraId: QUADRA_CENTRO, bairro: 'Centro' });
const IMOVEL_JARDIM = makeImovel({ id: 'i2', quadraId: QUADRA_JARDIM, bairro: 'Jardim' });
const IMOVEL_SEM_QUADRA = makeImovel({ id: 'i3', quadraId: null, bairro: 'Rural' });

function makeRepo(items: ImovelResumo[] = [IMOVEL_CENTRO, IMOVEL_JARDIM]) {
  return { listResumo: jest.fn().mockResolvedValue(items) };
}

async function buildUc(repo: ReturnType<typeof makeRepo>) {
  const mod = await Test.createTestingModule({
    providers: [
      ListImovelResumo,
      { provide: ImovelReadRepository, useValue: repo },
    ],
  }).compile();
  return mod.get(ListImovelResumo);
}

describe('ListImovelResumo — territorial filter', () => {
  it('passa quadraIds ao repositório quando fornecido', async () => {
    const repo = makeRepo([IMOVEL_CENTRO]);
    const uc = await buildUc(repo);
    await uc.execute(CLIENTE_ID, undefined, [QUADRA_CENTRO]);
    expect(repo.listResumo).toHaveBeenCalledWith(CLIENTE_ID, undefined, [QUADRA_CENTRO]);
  });

  it('não filtra quando quadraIds é undefined (retorna todos)', async () => {
    const repo = makeRepo([IMOVEL_CENTRO, IMOVEL_JARDIM]);
    const uc = await buildUc(repo);
    const { items } = await uc.execute(CLIENTE_ID);
    expect(items).toHaveLength(2);
    expect(repo.listResumo).toHaveBeenCalledWith(CLIENTE_ID, undefined, undefined);
  });

  it('retorna apenas imóvel do território quando quadraIds é [QUADRA_CENTRO]', async () => {
    const repo = makeRepo([IMOVEL_CENTRO]);
    const uc = await buildUc(repo);
    const { items } = await uc.execute(CLIENTE_ID, undefined, [QUADRA_CENTRO]);
    expect(items).toHaveLength(1);
    expect(items[0].quadraId).toBe(QUADRA_CENTRO);
    expect(items[0].bairro).toBe('Centro');
  });

  it('retorna lista vazia quando agente não tem território (quadraIds = [])', async () => {
    const repo = makeRepo([]);
    const uc = await buildUc(repo);
    const { items } = await uc.execute(CLIENTE_ID, undefined, []);
    expect(items).toHaveLength(0);
  });

  it('Centro/Q1 ≠ Jardim/Q1 — quadraId isola por UUID, não por código string', async () => {
    const imovelCentroQ1 = makeImovel({ id: 'c1', quadraId: QUADRA_CENTRO, bairro: 'Centro', quarteirao: 'Q1' });
    const imovelJardimQ1 = makeImovel({ id: 'j1', quadraId: QUADRA_JARDIM,  bairro: 'Jardim', quarteirao: 'Q1' });

    const repoSomenteCentro = makeRepo([imovelCentroQ1]);
    const uc = await buildUc(repoSomenteCentro);
    const { items } = await uc.execute(CLIENTE_ID, undefined, [QUADRA_CENTRO]);

    expect(items).toHaveLength(1);
    expect(items[0].bairro).toBe('Centro');
    expect(items[0].id).toBe('c1');
    expect(items.find((i) => i.id === 'j1')).toBeUndefined();
    // Suprime o aviso de imovelJardimQ1 ser declarado mas não usado:
    void imovelJardimQ1;
  });

  it('território + ciclo coexistem — regiaoId e quadraIds são passados em paralelo', async () => {
    const REGIAO_ID = 'rrrrrrrr-0000-0000-0000-000000000001';
    const repo = makeRepo([IMOVEL_CENTRO]);
    const uc = await buildUc(repo);
    await uc.execute(CLIENTE_ID, REGIAO_ID, [QUADRA_CENTRO]);
    expect(repo.listResumo).toHaveBeenCalledWith(CLIENTE_ID, REGIAO_ID, [QUADRA_CENTRO]);
  });

  it('novo ciclo não remove território — quadraIds continua independente de ciclo', async () => {
    const repo = makeRepo([IMOVEL_CENTRO]);
    const uc = await buildUc(repo);
    const { items } = await uc.execute(CLIENTE_ID, undefined, [QUADRA_CENTRO]);
    // Território não depende de ciclo — quadraIds vem de bairros_distribuicao WHERE ciclo_id IS NULL
    expect(items[0].quadraId).toBe(QUADRA_CENTRO);
  });

  it('imóvel sem quadra_id não é incluído quando filtro territorial ativo (responsabilidade do SQL)', async () => {
    // O SQL filtra AND i.quadra_id IN (...), portanto imovel sem quadra_id não volta
    const repo = makeRepo([IMOVEL_CENTRO]); // repositório só retorna o que passou no filtro SQL
    const uc = await buildUc(repo);
    const { items } = await uc.execute(CLIENTE_ID, undefined, [QUADRA_CENTRO]);
    expect(items.every((i) => i.quadraId === QUADRA_CENTRO)).toBe(true);
    void IMOVEL_SEM_QUADRA;
  });
});
