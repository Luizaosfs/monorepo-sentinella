import { Injectable } from '@nestjs/common';

import {
  CasoNotificado,
  ItemNotificacaoEsus,
  PushSubscription,
  UnidadeSaude,
} from '../entities/notificacao';

/** E.1.1 — dados do vínculo operacional caso ↔ foco (permanente, não apagado ao descartar). */
export interface VincularFocoCasoData {
  /** null apenas quando foco_vinculo_tipo = 'pendente_geocodificacao' */
  focoRiscoId: string | null;
  vinculadoEm: Date | null;
  vinculoTipo: 'existente_300m' | 'criado_por_caso' | 'pendente_geocodificacao';
  distanciaMetros: number | null;
}

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
  /** E.1.1 — persiste o vínculo operacional principal caso ↔ foco. */
  abstract vincularFoco(casoId: string, data: VincularFocoCasoData): Promise<void>;
}
