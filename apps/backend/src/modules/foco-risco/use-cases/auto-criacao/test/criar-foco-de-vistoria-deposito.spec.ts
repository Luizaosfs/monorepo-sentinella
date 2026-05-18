import { CriarFocoDeVistoriaDeposito } from '../criar-foco-de-vistoria-deposito';

type Mock = jest.Mock;

const mkPrisma = () => {
  const vistoriasFind: Mock = jest.fn();
  const imoveisFind: Mock = jest.fn();
  const focoCreate: Mock = jest.fn();
  const focosFindFirst: Mock = jest.fn().mockResolvedValue(null);
  const queryRaw: Mock = jest.fn().mockResolvedValue([{ ultimo: BigInt(1) }]);
  const txFocosUpdate: Mock = jest.fn().mockResolvedValue({});
  const txHistoricoCreateMany: Mock = jest.fn().mockResolvedValue({ count: 0 });
  const transaction: Mock = jest.fn().mockImplementation((fn: any) =>
    fn({ focos_risco: { update: txFocosUpdate }, foco_risco_historico: { createMany: txHistoricoCreateMany } }),
  );
  return {
    vistoriasFind,
    imoveisFind,
    focoCreate,
    focosFindFirst,
    queryRaw,
    transaction,
    service: {
      client: {
        vistorias: { findFirst: vistoriasFind },
        imoveis: { findFirst: imoveisFind },
        focos_risco: { create: focoCreate, findFirst: focosFindFirst },
        foco_risco_historico: { createMany: txHistoricoCreateMany },
        $queryRaw: queryRaw,
        $transaction: transaction,
      },
    } as any,
  };
};

const mkCruzar = () => ({
  execute: jest.fn().mockResolvedValue({ cruzamentos: 0 }),
} as any);

describe('CriarFocoDeVistoriaDeposito', () => {
  let useCase: CriarFocoDeVistoriaDeposito;
  let p: ReturnType<typeof mkPrisma>;
  let c: ReturnType<typeof mkCruzar>;

  beforeEach(() => {
    p = mkPrisma();
    c = mkCruzar();
    useCase = new CriarFocoDeVistoriaDeposito(p.service, c);
    p.focoCreate.mockResolvedValue({
      id: 'foco-1',
      cliente_id: 'cli-1',
      origem_levantamento_item_id: null,
      latitude: -10,
      longitude: -20,
    });
  });

  it('qtdComFocos = 0 → deposito_sem_foco', async () => {
    const r = await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 0, tratado: false });
    expect(r).toEqual({ criado: false, motivo: 'deposito_sem_foco' });
    expect(p.vistoriasFind).not.toHaveBeenCalled();
  });

  it('qtdComFocos = null → deposito_sem_foco', async () => {
    const r = await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: null, tratado: false });
    expect(r).toEqual({ criado: false, motivo: 'deposito_sem_foco' });
  });

  it('vistoria não encontrada → vistoria_nao_encontrada', async () => {
    p.vistoriasFind.mockResolvedValue(null);
    const r = await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-x', qtdComFocos: 1, tratado: false });
    expect(r).toEqual({ criado: false, motivo: 'vistoria_nao_encontrada' });
  });

  it('vistoria já tem foco_risco_id → vistoria_ja_vinculada (dedup)', async () => {
    p.vistoriasFind.mockResolvedValue({
      cliente_id: 'cli-1',
      imovel_id: 'imo-1',
      ciclo: 1,
      foco_risco_id: 'foco-existente',
    });
    const r = await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 1, tratado: false });
    expect(r).toEqual({ criado: false, motivo: 'vistoria_ja_vinculada' });
    expect(p.focoCreate).not.toHaveBeenCalled();
  });

  it('vistoria sem imóvel: cria foco com coords/endereco null', async () => {
    p.vistoriasFind.mockResolvedValue({
      cliente_id: 'cli-1',
      imovel_id: null,
      ciclo: 2,
      foco_risco_id: null,
    });
    const r = await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 1, tratado: false });
    expect(p.imoveisFind).not.toHaveBeenCalled();
    expect(p.focoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cliente_id: 'cli-1',
        imovel_id: null,
        bairro_id: null,
        origem_tipo: 'agente',
        origem_vistoria_id: 'v-1',
        status: 'em_triagem',
        ciclo: 2,
        latitude: null,
        longitude: null,
        endereco_normalizado: null,
      }),
    });
    expect(r).toEqual({ criado: true, focoId: 'foco-1' });
  });

  it('vistoria com imóvel: herda coords/endereco/regiao', async () => {
    p.vistoriasFind.mockResolvedValue({
      cliente_id: 'cli-1',
      imovel_id: 'imo-1',
      ciclo: 3,
      foco_risco_id: null,
    });
    p.imoveisFind.mockResolvedValue({
      bairro_id: 'reg-1',
      latitude: -23.5,
      longitude: -46.6,
      logradouro: 'Rua A',
      numero: '10',
    });
    await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 2, tratado: false });
    expect(p.focoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        imovel_id: 'imo-1',
        bairro_id: 'reg-1',
        origem_tipo: 'agente',
        origem_vistoria_id: 'v-1',
        status: 'em_triagem',
        ciclo: 3,
        latitude: -23.5,
        longitude: -46.6,
        endereco_normalizado: 'Rua A, 10',
      }),
    });
  });

  it('endereco_normalizado com numero null → "Rua A, S/N"', async () => {
    p.vistoriasFind.mockResolvedValue({
      cliente_id: 'cli-1',
      imovel_id: 'imo-1',
      ciclo: 1,
      foco_risco_id: null,
    });
    p.imoveisFind.mockResolvedValue({
      bairro_id: null,
      latitude: null,
      longitude: null,
      logradouro: 'Rua A',
      numero: null,
    });
    await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 1, tratado: false });
    expect(p.focoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ endereco_normalizado: 'Rua A, S/N' }),
    });
  });

  it('imóvel sem logradouro e sem numero → endereco_normalizado null', async () => {
    p.vistoriasFind.mockResolvedValue({
      cliente_id: 'cli-1',
      imovel_id: 'imo-1',
      ciclo: 1,
      foco_risco_id: null,
    });
    p.imoveisFind.mockResolvedValue({
      bairro_id: null,
      latitude: null,
      longitude: null,
      logradouro: null,
      numero: null,
    });
    await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 1, tratado: false });
    expect(p.focoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ endereco_normalizado: null }),
    });
  });

  it('origem_tipo = agente hard-coded', async () => {
    p.vistoriasFind.mockResolvedValue({
      cliente_id: 'cli-1',
      imovel_id: null,
      ciclo: 1,
      foco_risco_id: null,
    });
    await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 1, tratado: false });
    expect(p.focoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ origem_tipo: 'agente' }),
    });
  });

  it('E.1.2: foco novo confirmado (tratado=false) dispara CruzarFocoConfirmadoComCasos', async () => {
    p.vistoriasFind.mockResolvedValue({
      cliente_id: 'cli-1',
      imovel_id: null,
      ciclo: 1,
      foco_risco_id: null,
    });
    await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 1, tratado: false });
    expect(c.execute).toHaveBeenCalledWith(
      expect.objectContaining({ focoId: 'foco-1', clienteId: 'cli-1' }),
    );
  });

  it('E.1.2: foco novo já resolvido (tratado=true) NÃO cruza (paridade c/ CruzarCasoComFocos)', async () => {
    p.vistoriasFind.mockResolvedValue({
      cliente_id: 'cli-1',
      imovel_id: null,
      ciclo: 1,
      foco_risco_id: null,
    });
    await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 1, tratado: true });
    expect(c.execute).not.toHaveBeenCalled();
  });

  it('E.1.2: foco pré-vinculado (denúncia) confirmado pelo agente dispara o cruzamento', async () => {
    p.vistoriasFind.mockResolvedValue({
      cliente_id: 'cli-1',
      imovel_id: 'imo-1',
      ciclo: 1,
      foco_risco_id: 'foco-denuncia',
    });
    p.focosFindFirst.mockResolvedValue({ id: 'foco-denuncia', status: 'em_inspecao' });

    const r = await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 1, tratado: false });

    expect(r).toEqual({ criado: false, focoId: 'foco-denuncia' });
    expect(c.execute).toHaveBeenCalledWith({ focoId: 'foco-denuncia', clienteId: 'cli-1' });
  });

  it('autoClassificarFoco: origem agente → classificacao_inicial=suspeito (default)', async () => {
    p.vistoriasFind.mockResolvedValue({
      cliente_id: 'cli-1',
      imovel_id: null,
      ciclo: 1,
      foco_risco_id: null,
    });
    await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 1, tratado: false });
    expect(p.focoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ classificacao_inicial: 'suspeito' }),
    });
  });

  it('falha em CruzarFocoConfirmadoComCasos não reverte criação', async () => {
    p.vistoriasFind.mockResolvedValue({
      cliente_id: 'cli-1',
      imovel_id: null,
      ciclo: 1,
      foco_risco_id: null,
    });
    c.execute.mockRejectedValue(new Error('x'));
    const r = await useCase.execute({ clienteId: 'cli-1', vistoriaId: 'v-1', qtdComFocos: 1, tratado: false });
    expect(r).toEqual({ criado: true, focoId: 'foco-1' });
  });

  it('clienteId errado → findFirst retorna null → vistoria_nao_encontrada (IDOR guard)', async () => {
    p.vistoriasFind.mockResolvedValue(null);
    const r = await useCase.execute({ clienteId: 'outro-cli', vistoriaId: 'v-1', qtdComFocos: 1, tratado: false });
    expect(r).toEqual({ criado: false, motivo: 'vistoria_nao_encontrada' });
    expect(p.focoCreate).not.toHaveBeenCalled();
  });
});
