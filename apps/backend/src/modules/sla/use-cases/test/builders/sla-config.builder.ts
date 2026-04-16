import type { JsonObject } from '@shared/types/json';

import { SlaConfig, SlaFeriado } from '../../../entities/sla-config';

export class SlaConfigBuilder {
  private id = 'config-uuid-1';
  private clienteId = 'test-cliente-id';
  private config: JsonObject = { prazoP1: 8, prazoP2: 24, prazoP3: 48 };

  withId(id: string) {
    this.id = id;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withConfig(c: JsonObject) {
    this.config = c;
    return this;
  }

  build(): SlaConfig {
    return new SlaConfig({ clienteId: this.clienteId, config: this.config }, { id: this.id });
  }
}

export class SlaFeriadoBuilder {
  private id = 'feriado-uuid-1';
  private clienteId = 'test-cliente-id';
  private data = new Date('2024-12-25');
  private descricao = 'Natal';
  private nacional = true;

  withId(id: string) {
    this.id = id;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withData(d: Date) {
    this.data = d;
    return this;
  }
  withDescricao(desc: string) {
    this.descricao = desc;
    return this;
  }
  withNacional(n: boolean) {
    this.nacional = n;
    return this;
  }

  build(): SlaFeriado {
    return new SlaFeriado(
      {
        clienteId: this.clienteId,
        data: this.data,
        descricao: this.descricao,
        nacional: this.nacional,
      },
      { id: this.id },
    );
  }
}
