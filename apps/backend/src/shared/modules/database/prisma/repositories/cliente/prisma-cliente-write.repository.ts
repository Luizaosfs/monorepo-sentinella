import { Cliente } from '@modules/cliente/entities/cliente';
import { ClienteWriteRepository } from '@modules/cliente/repositories/cliente-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaClienteMapper } from '../../mappers/prisma-cliente.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(ClienteWriteRepository)
@Injectable()
export class PrismaClienteWriteRepository implements ClienteWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(cliente: Cliente): Promise<Cliente> {
    const data = PrismaClienteMapper.toPrisma(cliente);
    const created = await this.prisma.client.clientes.create({ data });
    return PrismaClienteMapper.toDomain(created as any);
  }

  async save(cliente: Cliente): Promise<void> {
    const data = PrismaClienteMapper.toPrisma(cliente);
    await this.prisma.client.clientes.update({
      where: { id: cliente.id },
      data,
    });
  }
}
