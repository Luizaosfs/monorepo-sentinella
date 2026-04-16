import { Injectable } from '@nestjs/common';

import { Reinspecao } from '../entities/reinspecao';

@Injectable()
export abstract class ReinspecaoWriteRepository {
  abstract create(entity: Reinspecao): Promise<Reinspecao>;
  abstract save(entity: Reinspecao): Promise<void>;
  abstract marcarPendentesVencidas(): Promise<{ atualizadas: number }>;
}
