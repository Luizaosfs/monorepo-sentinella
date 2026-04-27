import { Injectable } from '@nestjs/common';

import {
  CasoNotificado,
  ItemNotificacaoEsus,
  PushSubscription,
  UnidadeSaude,
} from '../entities/notificacao';

export interface CasosPaginados {
  items: CasoNotificado[];
  nextCursor: string | null;
}

@Injectable()
export abstract class NotificacaoReadRepository {
  abstract findUnidades(clienteId: string): Promise<UnidadeSaude[]>;
  abstract findUnidadeById(id: string, clienteId: string | null): Promise<UnidadeSaude | null>;
  abstract findCasos(
    clienteId: string,
    filters?: { status?: string; regiaoId?: string },
  ): Promise<CasoNotificado[]>;
  abstract findCasoById(id: string, clienteId: string | null): Promise<CasoNotificado | null>;
  abstract findPushByUsuario(usuarioId: string): Promise<PushSubscription[]>;
  abstract findEsus(clienteId: string): Promise<ItemNotificacaoEsus[]>;
  abstract findEsusById(id: string, clienteId: string | null): Promise<ItemNotificacaoEsus | null>;
  abstract findCasosPaginated(
    clienteId: string,
    limit: number,
    cursor?: string,
  ): Promise<CasosPaginados>;
  abstract findCasosNoRaio(
    lat: number,
    lng: number,
    raioMetros: number,
    clienteId: string,
  ): Promise<CasoNotificado[]>;
}
