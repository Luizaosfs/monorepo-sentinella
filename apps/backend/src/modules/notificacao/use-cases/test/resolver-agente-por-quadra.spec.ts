import { ResolverAgentePorQuadra } from '../resolver-agente-por-quadra';

describe('ResolverAgentePorQuadra', () => {
  let uc: ResolverAgentePorQuadra;
  let distFindFirst: jest.Mock;
  let usuarioFindUnique: jest.Mock;

  beforeEach(() => {
    distFindFirst = jest.fn();
    usuarioFindUnique = jest.fn();
    uc = new ResolverAgentePorQuadra({
      client: {
        bairros_distribuicao: { findFirst: distFindFirst },
        usuarios: { findUnique: usuarioFindUnique },
      },
    } as never);
  });

  it('usa território fixo (ciclo_id NULL) e resolve o nome do agente', async () => {
    distFindFirst.mockResolvedValueOnce({ agente_id: 'agente-1' });
    usuarioFindUnique.mockResolvedValueOnce({ nome: 'João' });

    const r = await uc.execute('cli1', 'quadra-1');

    expect(distFindFirst).toHaveBeenCalledTimes(1);
    expect(distFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cliente_id: 'cli1', quadra_id: 'quadra-1', ciclo_id: null },
      }),
    );
    expect(r).toEqual({ agenteId: 'agente-1', agenteNome: 'João' });
  });

  it('cai no fallback (distribuição mais recente) quando não há território fixo', async () => {
    distFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ agente_id: 'agente-2' });
    usuarioFindUnique.mockResolvedValueOnce({ nome: 'Maria' });

    const r = await uc.execute('cli1', 'quadra-1');

    expect(distFindFirst).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ agenteId: 'agente-2', agenteNome: 'Maria' });
  });

  it('retorna null quando não há distribuição alguma', async () => {
    distFindFirst.mockResolvedValue(null);

    const r = await uc.execute('cli1', 'quadra-1');

    expect(r).toEqual({ agenteId: null, agenteNome: null });
    expect(usuarioFindUnique).not.toHaveBeenCalled();
  });
});
