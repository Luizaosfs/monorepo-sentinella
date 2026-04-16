import { Injectable } from '@nestjs/common';

import { Usuario } from '../entities/usuario';

@Injectable()
export abstract class UsuarioWriteRepository {
  abstract create(usuario: Usuario): Promise<Usuario>;
  abstract save(usuario: Usuario): Promise<void>;
}
