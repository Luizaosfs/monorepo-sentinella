import { Usuario } from '@modules/usuario/entities/usuario';
import { UsuarioReadRepository } from '@modules/usuario/repositories/usuario-read.repository';
import { UsuarioWriteRepository } from '@modules/usuario/repositories/usuario-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaUsuarioMapper } from '../../mappers/prisma-usuario.mapper';
import { PrismaService } from '../../prisma.service';

const INCLUDE_PAPEIS = { papeis_usuarios: true } as const;

@PrismaRepository(UsuarioWriteRepository)
@Injectable()
export class PrismaUsuarioWriteRepository implements UsuarioWriteRepository {
  constructor(
    private prisma: PrismaService,
    private readRepository: UsuarioReadRepository,
  ) {}

  async create(usuario: Usuario): Promise<Usuario> {
    const data = PrismaUsuarioMapper.toPrisma(usuario);
    const created = await this.prisma.client.usuarios.create({
      data,
      include: INCLUDE_PAPEIS,
    });

    if (usuario.papeis.length > 0) {
      await this.prisma.client.papeis_usuarios.createMany({
        data: usuario.papeis.map((papel) => ({
          usuario_id: created.id,
          papel,
        })),
      });
    }

    return this.readRepository.findById(created.id) as Promise<Usuario>;
  }

  async save(usuario: Usuario): Promise<void> {
    const data = PrismaUsuarioMapper.toPrisma(usuario);
    await this.prisma.client.usuarios.update({
      where: { id: usuario.id },
      data,
    });
  }
}
