import { Injectable } from '@nestjs/common';

import { Regiao } from '../entities/regiao';

@Injectable()
export abstract class RegiaoWriteRepository {
  abstract create(regiao: Regiao): Promise<Regiao>;
  abstract save(regiao: Regiao): Promise<void>;
}
