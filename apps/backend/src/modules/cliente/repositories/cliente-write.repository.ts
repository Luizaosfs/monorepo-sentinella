import { Injectable } from '@nestjs/common';

import { Cliente } from '../entities/cliente';

@Injectable()
export abstract class ClienteWriteRepository {
  abstract create(cliente: Cliente): Promise<Cliente>;
  abstract save(cliente: Cliente): Promise<void>;
}
