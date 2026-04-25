import { ForbiddenException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';

import { SaveCicloBody } from '../../dtos/save-ciclo.body';
import { CicloException } from '../../errors/ciclo.exception';
import { CicloReadRepository } from '../../repositories/ciclo-read.repository';
import { CicloWriteRepository } from '../../repositories/ciclo-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { SaveCiclo } from '../save-ciclo';
import { CicloBuilder } from './builders/ciclo.builder';

const mockReq: any = {};

describe('SaveCiclo', () => {
  let useCase: SaveCiclo;
  const readRepo = mock<CicloReadRepository>();
  const writeRepo = mock<CicloWriteRepository>();

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq.user = { isPlatformAdmin: true };
    mockReq.tenantId = undefined;
    useCase = new SaveCiclo(readRepo, writeRepo, mockReq as any);
  });

  it('deve atualizar campos parciais do ciclo (numero, ano, status, datas, observações)', async () => {
    const ciclo = new CicloBuilder()
      .withNumero(1)
      .withAno(2024)
      .withStatus('planejamento')
      .withObservacaoAbertura('obs antiga')
      .build();
    readRepo.findById.mockResolvedValue(ciclo);
    writeRepo.save.mockResolvedValue();

    await useCase.execute(ciclo.id!, {
      numero: 3,
      ano: 2025,
      status: 'ativo',
      dataInicio: new Date('2025-05-01'),
      dataFimPrevista: new Date('2025-06-30'),
      observacaoAbertura: 'nova abertura',
      observacaoFechamento: 'fechamento',
    } as unknown as SaveCicloBody);

    expect(ciclo.numero).toBe(3);
    expect(ciclo.ano).toBe(2025);
    expect(ciclo.status).toBe('ativo');
    expect(ciclo.dataInicio).toEqual(new Date('2025-05-01'));
    expect(ciclo.dataFimPrevista).toEqual(new Date('2025-06-30'));
    expect(ciclo.observacaoAbertura).toBe('nova abertura');
    expect(ciclo.observacaoFechamento).toBe('fechamento');
    expect(writeRepo.save).toHaveBeenCalledWith(ciclo);
  });

  it('NÃO deve alterar campos não enviados no input', async () => {
    const dataInicio = new Date('2024-01-01');
    const dataFim = new Date('2024-02-29');
    const ciclo = new CicloBuilder()
      .withNumero(1)
      .withAno(2024)
      .withStatus('ativo')
      .withDataInicio(dataInicio)
      .withDataFimPrevista(dataFim)
      .withObservacaoAbertura('mantém')
      .build();
    readRepo.findById.mockResolvedValue(ciclo);
    writeRepo.save.mockResolvedValue();

    await useCase.execute(ciclo.id!, { numero: 2 } as SaveCicloBody);

    expect(ciclo.numero).toBe(2);
    expect(ciclo.ano).toBe(2024);
    expect(ciclo.status).toBe('ativo');
    expect(ciclo.dataInicio).toBe(dataInicio);
    expect(ciclo.dataFimPrevista).toBe(dataFim);
    expect(ciclo.observacaoAbertura).toBe('mantém');
  });

  it('deve rejeitar ciclo não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('x', { status: 'ativo' } as SaveCicloBody),
      CicloException.notFound(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('tenant errado → throw ForbiddenException, save não executado', async () => {
    const ciclo = new CicloBuilder().build();
    readRepo.findById.mockResolvedValue(ciclo);
    const wrongTenantReq = { user: { isPlatformAdmin: false }, tenantId: 'cli-ERRADO' };
    const uc = new SaveCiclo(readRepo, writeRepo, wrongTenantReq as any);

    await expect(uc.execute(ciclo.id!, { status: 'ativo' } as SaveCicloBody)).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.save).not.toHaveBeenCalled();
  });
});
