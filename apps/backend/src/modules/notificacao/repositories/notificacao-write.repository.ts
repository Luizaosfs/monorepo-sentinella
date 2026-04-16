import { Injectable } from '@nestjs/common';

import {
  CasoNotificado,
  ItemNotificacaoEsus,
  PushSubscription,
  UnidadeSaude,
} from '../entities/notificacao';

@Injectable()
export abstract class NotificacaoWriteRepository {
  abstract createUnidade(entity: UnidadeSaude): Promise<UnidadeSaude>;
  abstract saveUnidade(entity: UnidadeSaude): Promise<void>;
  abstract deleteUnidade(id: string): Promise<void>;
  abstract createCaso(entity: CasoNotificado): Promise<CasoNotificado>;
  abstract saveCaso(entity: CasoNotificado): Promise<void>;
  abstract deleteCaso(id: string): Promise<void>;
  abstract createPush(entity: PushSubscription): Promise<PushSubscription>;
  abstract deletePush(id: string): Promise<void>;
  abstract createEsus(
    entity: ItemNotificacaoEsus,
  ): Promise<ItemNotificacaoEsus>;
  abstract nextProtocolo(clienteId: string): Promise<string>;
}
