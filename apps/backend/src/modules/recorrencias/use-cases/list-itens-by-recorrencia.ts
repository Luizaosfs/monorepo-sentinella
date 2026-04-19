import { Injectable } from '@nestjs/common';

@Injectable()
export class ListItensByRecorrencia {
  // @deprecated — retorna array vazio (sem consumidor ativo no frontend)
  execute(_recorrenciaId: string): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}
