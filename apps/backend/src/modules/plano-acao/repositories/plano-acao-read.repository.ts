import { Injectable } from '@nestjs/common';

import {
  FilterPlanoAcaoAllInput,
  FilterPlanoAcaoInput,
} from '../dtos/filter-plano-acao.input';
import { PlanoAcao } from '../entities/plano-acao';

@Injectable()
export abstract class PlanoAcaoReadRepository {
  abstract findById(id: string, clienteId: string): Promise<PlanoAcao | null>;
  abstract findAllActive(
    filters: FilterPlanoAcaoInput,
  ): Promise<PlanoAcao[]>;
  abstract findAllIncludingInactive(
    filters: FilterPlanoAcaoAllInput,
  ): Promise<PlanoAcao[]>;
}
