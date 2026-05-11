import { mock } from 'jest-mock-extended';

import { DistribuicaoTerritorialItem } from '../../repositories/quarteirao-read.repository';
import { QuarteiraoReadRepository } from '../../repositories/quarteirao-read.repository';
import { QuarteiraoWriteRepository } from '../../repositories/quarteirao-write.repository';
import { ListarDistribuicaoTerritorial } from '../listar-distribuicao-territorial';
import { DistribuicaoBuilder } from './builders/quarteirao.builder';

const CLIENTE = 'aaaaaaaa-0000-0000-0000-000000000001';
const CICLO   = 'eeeeeeee-0000-0000-0000-000000000001';
const QUADRA  = 'dddddddd-0000-0000-0000-000000000001';
const AGENTE  = 'bbbbbbbb-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// 1. DistribuicaoQuarteirao entity aceita cicloId = null (territorial)
// ---------------------------------------------------------------------------
describe('Fase C — entidade DistribuicaoQuarteirao', () => {
  it('aceita cicloId = null (distribuição territorial)', () => {
    const dist = new DistribuicaoBuilder().withCicloIdNull().build();
    expect(dist.cicloId).toBeNull();
  });

  it('aceita cicloId = string (distribuição por ciclo)', () => {
    const dist = new DistribuicaoBuilder().withCicloId(CICLO).build();
    expect(dist.cicloId).toBe(CICLO);
  });

  it('cicloId setter aceita null', () => {
    const dist = new DistribuicaoBuilder().withCicloId(CICLO).build();
    dist.cicloId = null;
    expect(dist.cicloId).toBeNull();
  });

  it('cicloId setter aceita string', () => {
    const dist = new DistribuicaoBuilder().withCicloIdNull().build();
    dist.cicloId = CICLO;
    expect(dist.cicloId).toBe(CICLO);
  });
});

// ---------------------------------------------------------------------------
// 2. ListarDistribuicaoTerritorial — cicloIdOrigem pode ser null
// ---------------------------------------------------------------------------
describe('Fase C — ListarDistribuicaoTerritorial com cicloId null', () => {
  let useCase: ListarDistribuicaoTerritorial;
  const readRepo = mock<QuarteiraoReadRepository>();

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ListarDistribuicaoTerritorial(readRepo);
  });

  it('retorna distribuição territorial com cicloIdOrigem preenchido', async () => {
    const item: DistribuicaoTerritorialItem = {
      quadraId: QUADRA,
      codigo: 'Q1',
      bairroId: null,
      bairroNome: null,
      agenteId: AGENTE,
      agenteNome: 'João',
      cicloIdOrigem: CICLO,
      updatedAt: new Date('2026-03-01'),
    };
    readRepo.findDistribuicaoTerritorialAtual.mockResolvedValue([item]);

    const result = await useCase.execute(CLIENTE);

    expect(result[0].cicloIdOrigem).toBe(CICLO);
    expect(result[0].quadraId).toBe(QUADRA);
  });

  it('distribuição com bairroId null (sem bairro vinculado) é retornada normalmente', async () => {
    const item: DistribuicaoTerritorialItem = {
      quadraId: QUADRA,
      codigo: 'Q1',
      bairroId: null,
      bairroNome: null,
      agenteId: AGENTE,
      agenteNome: 'João',
      cicloIdOrigem: CICLO,
      updatedAt: new Date(),
    };
    readRepo.findDistribuicaoTerritorialAtual.mockResolvedValue([item]);

    const result = await useCase.execute(CLIENTE);

    expect(result[0].bairroId).toBeNull();
    expect(result[0].bairroNome).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Builder — compatibilidade cicloId null e string
// ---------------------------------------------------------------------------
describe('Fase C — DistribuicaoBuilder compatibilidade', () => {
  it('build() com cicloId string funciona', () => {
    const d = new DistribuicaoBuilder().withCicloId(CICLO).build();
    expect(d.cicloId).toBe(CICLO);
    expect(d.quadraId).toBeTruthy();
    expect(d.agenteId).toBeTruthy();
  });

  it('build() com cicloId null funciona (territorial)', () => {
    const d = new DistribuicaoBuilder().withCicloIdNull().build();
    expect(d.cicloId).toBeNull();
    expect(d.quadraId).toBeTruthy();
    expect(d.agenteId).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. Write repository interface aceita cicloId null
// ---------------------------------------------------------------------------
describe('Fase C — QuarteiraoWriteRepository mock com distribuição territorial', () => {
  const writeRepo = mock<QuarteiraoWriteRepository>();

  it('createDistribuicao aceita entidade com cicloId null', async () => {
    const dist = new DistribuicaoBuilder().withCicloIdNull().build();
    writeRepo.createDistribuicao.mockResolvedValue(dist);

    const result = await writeRepo.createDistribuicao(dist);

    expect(result.cicloId).toBeNull();
    expect(result.quadraId).toBeTruthy();
  });

  it('createDistribuicao aceita entidade com cicloId UUID', async () => {
    const dist = new DistribuicaoBuilder().withCicloId(CICLO).build();
    writeRepo.createDistribuicao.mockResolvedValue(dist);

    const result = await writeRepo.createDistribuicao(dist);

    expect(result.cicloId).toBe(CICLO);
  });
});
