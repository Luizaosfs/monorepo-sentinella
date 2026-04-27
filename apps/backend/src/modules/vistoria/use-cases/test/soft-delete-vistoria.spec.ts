import { ForbiddenException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';

import { CloudinaryService } from '@/modules/cloudinary/cloudinary.service';

import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { SoftDeleteVistoria } from '../soft-delete-vistoria';
import { VistoriaBuilder } from './builders/vistoria.builder';

const CLIENTE_ID = '00000000-0000-4000-8000-000000000001';

function makeReq(opts: { papeis?: string[]; isPlatformAdmin?: boolean; tenantId?: string } = {}) {
  return {
    user: {
      papeis: opts.papeis ?? ['supervisor'],
      isPlatformAdmin: opts.isPlatformAdmin ?? false,
    },
    tenantId: opts.tenantId ?? CLIENTE_ID,
  };
}

function makeUseCase(req: ReturnType<typeof makeReq>) {
  return new SoftDeleteVistoria(readRepo, writeRepo, cloudinary, req as any);
}

const readRepo = mock<VistoriaReadRepository>();
const writeRepo = mock<VistoriaWriteRepository>();
const cloudinary = mock<CloudinaryService>();

beforeEach(() => {
  jest.clearAllMocks();
  writeRepo.softDelete.mockResolvedValue(undefined);
  cloudinary.registrarOrfao.mockResolvedValue(undefined as any);
  readRepo.findCalhasByVistoriaId.mockResolvedValue([]);
});

describe('SoftDeleteVistoria', () => {
  it('vistoria não encontrada → throw VistoriaException.notFound()', async () => {
    readRepo.findByIdIncludingDeleted.mockResolvedValue(null);
    const useCase = makeUseCase(makeReq());

    await expect(useCase.execute('nao-existe')).rejects.toMatchObject({
      response: { statusCode: 404, message: 'Vistoria não encontrada' },
    });
  });

  it('tenant ownership inválido → 404 (DB filtra), softDelete não chamado', async () => {
    const v = new VistoriaBuilder().build();
    readRepo.findByIdIncludingDeleted.mockImplementation(async (_id, clienteId) =>
      clienteId === 'outro-tenant' ? null : v,
    );
    const useCase = makeUseCase(makeReq({ tenantId: 'outro-tenant' }));

    await expect(useCase.execute(v.id!)).rejects.toBeDefined();
    expect(writeRepo.softDelete).not.toHaveBeenCalled();
  });

  it('agente comum tenta deletar → throw ForbiddenException', async () => {
    const v = new VistoriaBuilder().build();
    readRepo.findByIdIncludingDeleted.mockResolvedValue(v);
    const useCase = makeUseCase(makeReq({ papeis: ['agente'] }));

    await expect(useCase.execute(v.id!)).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.softDelete).not.toHaveBeenCalled();
  });

  it('supervisor deleta → ok', async () => {
    const v = new VistoriaBuilder().build();
    readRepo.findByIdIncludingDeleted.mockResolvedValue(v);
    const useCase = makeUseCase(makeReq({ papeis: ['supervisor'] }));

    await expect(useCase.execute(v.id!)).resolves.toBeUndefined();
    expect(writeRepo.softDelete).toHaveBeenCalledWith(v.id);
  });

  it('admin (isPlatformAdmin) deleta → ok', async () => {
    const v = new VistoriaBuilder().build();
    readRepo.findByIdIncludingDeleted.mockResolvedValue(v);
    const useCase = makeUseCase(makeReq({ papeis: ['admin'], isPlatformAdmin: true }));

    await expect(useCase.execute(v.id!)).resolves.toBeUndefined();
    expect(writeRepo.softDelete).toHaveBeenCalledWith(v.id);
  });

  it('DELETE 2x → idempotência: 2ª chamada retorna sem chamar writeRepo nem cloudinary', async () => {
    const v = new VistoriaBuilder().build();
    v.deletedAt = new Date();
    readRepo.findByIdIncludingDeleted.mockResolvedValue(v);
    const useCase = makeUseCase(makeReq());

    await expect(useCase.execute(v.id!)).resolves.toBeUndefined();
    expect(writeRepo.softDelete).not.toHaveBeenCalled();
    expect(cloudinary.registrarOrfao).not.toHaveBeenCalled();
  });

  it('softDelete chamado antes de registrarOrfao', async () => {
    const callOrder: string[] = [];
    writeRepo.softDelete.mockImplementation(async () => { callOrder.push('softDelete'); });
    cloudinary.registrarOrfao.mockImplementation(async () => { callOrder.push('registrarOrfao'); return undefined as any; });

    const v = new VistoriaBuilder().build();
    v.assinaturaPublicId = 'pub-assinatura';
    v.assinaturaResponsavelUrl = 'https://cdn/assinatura.png';
    readRepo.findByIdIncludingDeleted.mockResolvedValue(v);
    const useCase = makeUseCase(makeReq());

    await useCase.execute(v.id!);

    expect(callOrder[0]).toBe('softDelete');
    expect(callOrder[1]).toBe('registrarOrfao');
  });

  it('vistoria com assinatura → registrarOrfao chamado com origemTabela=vistorias', async () => {
    const v = new VistoriaBuilder().build();
    v.assinaturaPublicId = 'pub-assin-1';
    v.assinaturaResponsavelUrl = 'https://cdn/assin.png';
    readRepo.findByIdIncludingDeleted.mockResolvedValue(v);
    const useCase = makeUseCase(makeReq());

    await useCase.execute(v.id!);

    expect(cloudinary.registrarOrfao).toHaveBeenCalledWith(
      'pub-assin-1',
      'https://cdn/assin.png',
      'vistorias',
      v.id,
      CLIENTE_ID,
    );
  });

  it('vistoria sem assinatura mas com foto_externa → apenas foto_externa registrada', async () => {
    const v = new VistoriaBuilder().build();
    v.fotoExternaPublicId = 'pub-foto-ext';
    v.fotoExternaUrl = 'https://cdn/ext.jpg';
    readRepo.findByIdIncludingDeleted.mockResolvedValue(v);
    const useCase = makeUseCase(makeReq());

    await useCase.execute(v.id!);

    expect(cloudinary.registrarOrfao).toHaveBeenCalledTimes(1);
    expect(cloudinary.registrarOrfao).toHaveBeenCalledWith(
      'pub-foto-ext',
      'https://cdn/ext.jpg',
      'vistorias',
      v.id,
      CLIENTE_ID,
    );
  });

  it('vistoria com 2 calhas com foto → registrarOrfao chamado 2x com vistoria_calhas', async () => {
    const v = new VistoriaBuilder().build();
    readRepo.findByIdIncludingDeleted.mockResolvedValue(v);
    readRepo.findCalhasByVistoriaId.mockResolvedValue([
      { id: 'calha-1', fotoPublicId: 'pub-c1', fotoUrl: 'https://cdn/c1.jpg' },
      { id: 'calha-2', fotoPublicId: 'pub-c2', fotoUrl: 'https://cdn/c2.jpg' },
    ]);
    const useCase = makeUseCase(makeReq());

    await useCase.execute(v.id!);

    expect(cloudinary.registrarOrfao).toHaveBeenCalledTimes(2);
    expect(cloudinary.registrarOrfao).toHaveBeenCalledWith(
      'pub-c1', 'https://cdn/c1.jpg', 'vistoria_calhas', 'calha-1', CLIENTE_ID,
    );
    expect(cloudinary.registrarOrfao).toHaveBeenCalledWith(
      'pub-c2', 'https://cdn/c2.jpg', 'vistoria_calhas', 'calha-2', CLIENTE_ID,
    );
  });

  it('registrarOrfao falha na assinatura → ainda registra foto_externa (best-effort isolado)', async () => {
    const v = new VistoriaBuilder().build();
    v.assinaturaPublicId = 'pub-assin';
    v.assinaturaResponsavelUrl = 'https://cdn/assin.png';
    v.fotoExternaPublicId = 'pub-ext';
    v.fotoExternaUrl = 'https://cdn/ext.jpg';
    readRepo.findByIdIncludingDeleted.mockResolvedValue(v);
    cloudinary.registrarOrfao
      .mockRejectedValueOnce(new Error('cloudinary down'))
      .mockResolvedValueOnce(undefined as any);
    const useCase = makeUseCase(makeReq());

    await expect(useCase.execute(v.id!)).resolves.toBeUndefined();
    expect(cloudinary.registrarOrfao).toHaveBeenCalledTimes(2);
  });
});
