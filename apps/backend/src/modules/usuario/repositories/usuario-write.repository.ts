import { Injectable } from '@nestjs/common';

import { PapelApp } from '@/decorators/roles.decorator';

import { Usuario } from '../entities/usuario';

@Injectable()
export abstract class UsuarioWriteRepository {
  abstract create(usuario: Usuario): Promise<Usuario>;
  abstract save(usuario: Usuario): Promise<void>;
  abstract atribuirPapel(authId: string, papel: PapelApp): Promise<void>;
}
