import { Injectable } from '@nestjs/common';

import {
  BillingCiclo,
  ClientePlano,
  ClienteQuotas,
  Plano,
} from '../entities/billing';

@Injectable()
export abstract class BillingWriteRepository {
  abstract createPlano(entity: Plano): Promise<Plano>;
  abstract savePlano(entity: Plano): Promise<void>;
  abstract createClientePlano(entity: ClientePlano): Promise<ClientePlano>;
  abstract saveClientePlano(entity: ClientePlano): Promise<void>;
  abstract createCiclo(entity: BillingCiclo): Promise<BillingCiclo>;
  abstract saveCiclo(entity: BillingCiclo): Promise<void>;
  abstract upsertQuotas(entity: ClienteQuotas): Promise<ClienteQuotas>;
}
