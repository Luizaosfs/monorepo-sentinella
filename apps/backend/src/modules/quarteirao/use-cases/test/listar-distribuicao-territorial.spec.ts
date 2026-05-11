import { mock } from 'jest-mock-extended';

import { DistribuicaoTerritorialItem } from '../../repositories/quarteirao-read.repository';
import { QuarteiraoReadRepository } from '../../repositories/quarteirao-read.repository';
import { ListarDistribuicaoTerritorial } from '../listar-distribuicao-territorial';

const CLIENTE = 'aaaaaaaa-0000-0000-0000-000000000001';
const AGENTE_A = 'bbbbbbbb-0000-0000-0000-000000000001';
const AGENTE_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const BAIRRO_CENTRO = 'cccccccc-0000-0000-0000-000000000001';
const BAIRRO_JARDIM = 'cccccccc-0000-0000-0000-000000000002';
const QUADRA_CENTRO_Q1 = 'dddddddd-0000-0000-0000-000000000001';
const QUADRA_JARDIM_Q1 = 'dddddddd-0000-0000-0000-000000000002';
const CICLO_ORIGEM = 'eeeeeeee-0000-0000-0000-000000000001';

const mockItems: DistribuicaoTerritorialItem[] = [
  {
    quadraId: QUADRA_CENTRO_Q1,
    codigo: 'Q1',
    bairroId: BAIRRO_CENTRO,
    bairroNome: 'Centro',
    agenteId: AGENTE_A,
    agenteNome: 'João Silva',
    cicloIdOrigem: CICLO_ORIGEM,
    updatedAt: new Date('2026-03-01T10:00:00Z'),
  },
  {
    quadraId: QUADRA_JARDIM_Q1,
    codigo: 'Q1',
    bairroId: BAIRRO_JARDIM,
    bairroNome: 'Jardim das Flores',
    agenteId: AGENTE_B,
    agenteNome: 'Maria Souza',
    cicloIdOrigem: CICLO_ORIGEM,
    updatedAt: new Date('2026-03-01T10:00:00Z'),
  },
];

describe('ListarDistribuicaoTerritorial', () => {
  let useCase: ListarDistribuicaoTerritorial;
  const readRepo = mock<QuarteiraoReadRepository>();

  beforeEach(() => {
    jest.clearAllMocks();
    readRepo.findDistribuicaoTerritorialAtual.mockResolvedValue(mockItems);
    useCase = new ListarDistribuicaoTerritorial(readRepo);
  });

  it('lista distribuição territorial sem cicloId', async () => {
    const result = await useCase.execute(CLIENTE);

    expect(readRepo.findDistribuicaoTerritorialAtual).toHaveBeenCalledWith(
      CLIENTE,
      undefined,
      undefined,
    );
    expect(result).toHaveLength(2);
  });

  it('Centro/Q1 e Jardim/Q1 são quadras distintas por UUID com mesmo código', async () => {
    const result = await useCase.execute(CLIENTE);

    const centroQ1 = result.find(r => r.bairroNome === 'Centro');
    const jardimQ1 = result.find(r => r.bairroNome === 'Jardim das Flores');

    expect(centroQ1).toBeDefined();
    expect(jardimQ1).toBeDefined();
    expect(centroQ1!.codigo).toBe('Q1');
    expect(jardimQ1!.codigo).toBe('Q1');
    expect(centroQ1!.quadraId).not.toBe(jardimQ1!.quadraId);
    expect(centroQ1!.quadraId).toBe(QUADRA_CENTRO_Q1);
    expect(jardimQ1!.quadraId).toBe(QUADRA_JARDIM_Q1);
  });

  it('filtra por agenteId', async () => {
    readRepo.findDistribuicaoTerritorialAtual.mockResolvedValue([mockItems[0]]);

    const result = await useCase.execute(CLIENTE, AGENTE_A);

    expect(readRepo.findDistribuicaoTerritorialAtual).toHaveBeenCalledWith(
      CLIENTE,
      AGENTE_A,
      undefined,
    );
    expect(result).toHaveLength(1);
    expect(result[0].agenteId).toBe(AGENTE_A);
  });

  it('filtra por bairroId', async () => {
    readRepo.findDistribuicaoTerritorialAtual.mockResolvedValue([mockItems[1]]);

    const result = await useCase.execute(CLIENTE, undefined, BAIRRO_JARDIM);

    expect(readRepo.findDistribuicaoTerritorialAtual).toHaveBeenCalledWith(
      CLIENTE,
      undefined,
      BAIRRO_JARDIM,
    );
    expect(result).toHaveLength(1);
    expect(result[0].bairroId).toBe(BAIRRO_JARDIM);
  });

  it('filtra por agenteId e bairroId combinados', async () => {
    readRepo.findDistribuicaoTerritorialAtual.mockResolvedValue([mockItems[0]]);

    const result = await useCase.execute(CLIENTE, AGENTE_A, BAIRRO_CENTRO);

    expect(readRepo.findDistribuicaoTerritorialAtual).toHaveBeenCalledWith(
      CLIENTE,
      AGENTE_A,
      BAIRRO_CENTRO,
    );
    expect(result).toHaveLength(1);
    expect(result[0].agenteId).toBe(AGENTE_A);
    expect(result[0].bairroId).toBe(BAIRRO_CENTRO);
  });

  it('retorna UUID correto por quadra e cicloIdOrigem rastreável', async () => {
    const result = await useCase.execute(CLIENTE);

    result.forEach(item => {
      expect(item.quadraId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(item.cicloIdOrigem).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  it('retorna array vazio quando não há distribuições', async () => {
    readRepo.findDistribuicaoTerritorialAtual.mockResolvedValue([]);

    const result = await useCase.execute(CLIENTE);

    expect(result).toHaveLength(0);
  });

  it('clienteId diferente não retorna dados de outro cliente', async () => {
    readRepo.findDistribuicaoTerritorialAtual.mockResolvedValue([]);

    const result = await useCase.execute('outro-cliente-uuid', AGENTE_A);

    expect(readRepo.findDistribuicaoTerritorialAtual).toHaveBeenCalledWith(
      'outro-cliente-uuid',
      AGENTE_A,
      undefined,
    );
    expect(result).toHaveLength(0);
  });

  it('inclui bairroNome e agenteNome no resultado', async () => {
    const result = await useCase.execute(CLIENTE);

    expect(result[0].bairroNome).toBe('Centro');
    expect(result[0].agenteNome).toBe('João Silva');
    expect(result[1].bairroNome).toBe('Jardim das Flores');
    expect(result[1].agenteNome).toBe('Maria Souza');
  });
});
