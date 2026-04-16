import { Injectable } from '@nestjs/common';

import { ReinspecaoWriteRepository } from '../repositories/reinspecao-write.repository';

@Injectable()
export class MarcarVencidas {
  constructor(private repository: ReinspecaoWriteRepository) {}

  async execute() {
    return this.repository.marcarPendentesVencidas();
  }
}
