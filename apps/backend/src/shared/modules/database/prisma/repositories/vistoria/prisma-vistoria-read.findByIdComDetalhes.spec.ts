import { PrismaVistoriaMapper } from '../../mappers/prisma-vistoria.mapper';
import { PrismaService } from '../../prisma.service';
import { PrismaVistoriaReadRepository } from './prisma-vistoria-read.repository';
import { Vistoria } from 'src/modules/vistoria/entities/vistoria';

describe('PrismaVistoriaReadRepository.findByIdComDetalhes — isolamento cross-tenant', () => {
  let repo: PrismaVistoriaReadRepository;
  let findFirst: jest.Mock;

  const fakeVistoria = { id: 'vis-1' } as unknown as Vistoria;

  beforeEach(() => {
    findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      client: { vistorias: { findFirst } },
    } as unknown as PrismaService;
    repo = new PrismaVistoriaReadRepository(prisma);
    jest.spyOn(PrismaVistoriaMapper, 'toDomain').mockReturnValue(fakeVistoria);
  });

  afterEach(() => jest.restoreAllMocks());

  it('clienteId correto — passa cliente_id no where e retorna vistoria', async () => {
    findFirst.mockResolvedValue({ id: 'vis-1' });

    const result = await repo.findByIdComDetalhes('vis-1', 'tenant-a');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'vis-1', cliente_id: 'tenant-a' }),
      }),
    );
    expect(result).toBe(fakeVistoria);
  });

  it('clienteId errado — where filtra por outro tenant, mock retorna null', async () => {
    findFirst.mockResolvedValue(null);

    const result = await repo.findByIdComDetalhes('vis-1', 'tenant-b');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'vis-1', cliente_id: 'tenant-b' }),
      }),
    );
    expect(result).toBeNull();
  });

  it('clienteId null (admin platform) — where não contém cliente_id, retorna vistoria', async () => {
    findFirst.mockResolvedValue({ id: 'vis-1' });

    const result = await repo.findByIdComDetalhes('vis-1', null);

    const callArg = findFirst.mock.calls[0][0];
    expect(callArg.where).not.toHaveProperty('cliente_id');
    expect(result).toBe(fakeVistoria);
  });
});
