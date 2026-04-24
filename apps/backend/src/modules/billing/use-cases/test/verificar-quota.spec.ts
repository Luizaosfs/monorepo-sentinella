import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ClientePlano, ClienteQuotas, Plano } from '../../entities/billing';
import { BillingReadRepository } from '../../repositories/billing-read.repository';

import { VerificarQuota } from '../verificar-quota';

const makePlano = (overrides: Partial<{
  limiteVoosMes: number;
  limiteLevantamentosMes: number;
  limiteVistoriasMes: number;
  limiteUsuarios: number;
}> = {}) =>
  new Plano(
    {
      nome: 'basico',
      ativo: true,
      droneHabilitado: false,
      slaAvancado: false,
      integracoesHabilitadas: [],
      ordem: 1,
      limiteVoosMes: overrides.limiteVoosMes,
      limiteLevantamentosMes: overrides.limiteLevantamentosMes,
      limiteVistoriasMes: overrides.limiteVistoriasMes,
      limiteUsuarios: overrides.limiteUsuarios,
    },
    { id: 'plano-1' },
  );

const makeClientePlano = (status: string, dataTrialFim?: Date) =>
  new ClientePlano(
    { clienteId: 'cli-1', planoId: 'plano-1', status, dataInicio: new Date(), dataTrialFim },
    { id: 'cp-1' },
  );

describe('VerificarQuota', () => {
  let useCase: VerificarQuota;
  const readRepo = mock<BillingReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    readRepo.findClientePlano.mockResolvedValue(makeClientePlano('ativo'));
    readRepo.findQuotas.mockResolvedValue(null);
    readRepo.findPlanoById.mockResolvedValue(null);
    readRepo.findContagemMetrica.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificarQuota,
        { provide: BillingReadRepository, useValue: readRepo },
      ],
    }).compile();

    useCase = module.get<VerificarQuota>(VerificarQuota);
  });

  it('tenant_bloqueado se status=suspenso', async () => {
    readRepo.findClientePlano.mockResolvedValue(makeClientePlano('suspenso'));

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' });

    expect(result).toEqual({ ok: false, usado: 0, limite: 0, motivo: 'tenant_bloqueado' });
  });

  it('tenant_bloqueado se status=cancelado', async () => {
    readRepo.findClientePlano.mockResolvedValue(makeClientePlano('cancelado'));

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' });

    expect(result.ok).toBe(false);
    expect(result.motivo).toBe('tenant_bloqueado');
  });

  it('tenant_bloqueado se status=trial AND dataTrialFim < now', async () => {
    const passado = new Date(Date.now() - 86400_000);
    readRepo.findClientePlano.mockResolvedValue(makeClientePlano('trial', passado));

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' });

    expect(result.ok).toBe(false);
    expect(result.motivo).toBe('tenant_bloqueado');
  });

  it('status=trial AND dataTrialFim > now → NÃO bloqueia', async () => {
    const futuro = new Date(Date.now() + 86400_000);
    readRepo.findClientePlano.mockResolvedValue(makeClientePlano('trial', futuro));
    readRepo.findPlanoById.mockResolvedValue(makePlano({ limiteVoosMes: 100 }));
    readRepo.findContagemMetrica.mockResolvedValue(3);

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' });

    expect(result.ok).toBe(true);
    expect(result.motivo).toBeUndefined();
  });

  it('override em cliente_quotas tem precedência sobre plano', async () => {
    readRepo.findQuotas.mockResolvedValue(
      new ClienteQuotas({ clienteId: 'cli-1', voosMes: 5 }, {}),
    );
    readRepo.findPlanoById.mockResolvedValue(makePlano({ limiteVoosMes: 100 }));
    readRepo.findContagemMetrica.mockResolvedValue(3);

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' });

    expect(result.limite).toBe(5);
  });

  it('sem override → usa limite do plano', async () => {
    readRepo.findQuotas.mockResolvedValue(null);
    readRepo.findPlanoById.mockResolvedValue(makePlano({ limiteVoosMes: 50 }));
    readRepo.findContagemMetrica.mockResolvedValue(10);

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' });

    expect(result.limite).toBe(50);
    expect(result.ok).toBe(true);
  });

  it('ambos NULL → limite=null, ok=true (ilimitado)', async () => {
    readRepo.findQuotas.mockResolvedValue(null);
    readRepo.findPlanoById.mockResolvedValue(makePlano());
    readRepo.findContagemMetrica.mockResolvedValue(999);

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' });

    expect(result.limite).toBeNull();
    expect(result.ok).toBe(true);
  });

  it('usado >= limite → ok=false, motivo=excedido', async () => {
    readRepo.findPlanoById.mockResolvedValue(makePlano({ limiteVoosMes: 10 }));
    readRepo.findContagemMetrica.mockResolvedValue(10);

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' });

    expect(result.ok).toBe(false);
    expect(result.motivo).toBe('excedido');
    expect(result.usado).toBe(10);
    expect(result.limite).toBe(10);
  });

  it('usuarios_ativos usa findContagemMetrica com metrica correta', async () => {
    readRepo.findPlanoById.mockResolvedValue(makePlano({ limiteUsuarios: 20 }));
    readRepo.findContagemMetrica.mockResolvedValue(5);

    const result = await useCase.execute('cli-1', { metrica: 'usuarios_ativos' });

    expect(readRepo.findContagemMetrica).toHaveBeenCalledWith('cli-1', 'usuarios_ativos');
    expect(result.ok).toBe(true);
    expect(result.usado).toBe(5);
  });

  it('fail_safe: erro interno retorna ok=true, motivo=fail_safe', async () => {
    readRepo.findClientePlano.mockRejectedValueOnce(new Error('DB down'));

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' });

    expect(result).toEqual({ ok: true, usado: 0, limite: null, motivo: 'fail_safe' });
  });

  it('ia_calls_mes → ok=true, limite=null sem consultar repositório', async () => {
    const result = await useCase.execute('cli-1', { metrica: 'ia_calls_mes' });

    expect(result).toEqual({ ok: true, usado: 0, limite: null });
    expect(readRepo.findClientePlano).not.toHaveBeenCalled();
  });

  it('storage_gb → ok=true, limite=null sem consultar repositório', async () => {
    const result = await useCase.execute('cli-1', { metrica: 'storage_gb' });

    expect(result).toEqual({ ok: true, usado: 0, limite: null });
    expect(readRepo.findClientePlano).not.toHaveBeenCalled();
  });

  it('vistorias_mes usa findContagemMetrica com metrica correta', async () => {
    readRepo.findPlanoById.mockResolvedValue(makePlano({ limiteVistoriasMes: 200 }));
    readRepo.findContagemMetrica.mockResolvedValue(50);

    const result = await useCase.execute('cli-1', { metrica: 'vistorias_mes' });

    expect(readRepo.findContagemMetrica).toHaveBeenCalledWith('cli-1', 'vistorias_mes');
    expect(result.limite).toBe(200);
    expect(result.ok).toBe(true);
  });
});
