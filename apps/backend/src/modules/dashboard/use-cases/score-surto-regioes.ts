import { Injectable } from '@nestjs/common';

import {
  DashboardReadRepository,
  ScoreSurtoRow,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class ScoreSurtoRegioes {
  constructor(private readRepository: DashboardReadRepository) {}

  execute(clienteId: string): Promise<ScoreSurtoRow[]> {
    return this.readRepository.scoreSurtoRegioes(clienteId);
  }
}
