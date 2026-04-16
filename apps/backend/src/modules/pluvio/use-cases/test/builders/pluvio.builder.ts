import { PluvioItem, PluvioRun } from '../../../entities/pluvio';

export class PluvioRunBuilder {
  private id = 'run-uuid-1';
  private clienteId = 'test-cliente-id';
  private dataReferencia = new Date('2024-06-15');
  private total: number | undefined = 50;
  private status: string | undefined = 'pendente';

  withId(id: string) {
    this.id = id;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withDataReferencia(d: Date) {
    this.dataReferencia = d;
    return this;
  }
  withTotal(t: number) {
    this.total = t;
    return this;
  }
  withStatus(s: string) {
    this.status = s;
    return this;
  }

  build(): PluvioRun {
    return new PluvioRun(
      {
        clienteId: this.clienteId,
        dataReferencia: this.dataReferencia,
        total: this.total,
        status: this.status,
      },
      { id: this.id },
    );
  }
}

export class PluvioItemBuilder {
  private id = 'item-pluvio-uuid-1';
  private runId = 'run-uuid-1';
  private regiaoId: string | undefined = 'regiao-uuid-1';
  private imovelId: string | undefined = undefined;
  private precipitacao = 25.5;
  private nivelRisco = 'medio';

  withId(id: string) {
    this.id = id;
    return this;
  }
  withRunId(id: string) {
    this.runId = id;
    return this;
  }
  withRegiaoId(id: string) {
    this.regiaoId = id;
    return this;
  }
  withPrecipitacao(p: number) {
    this.precipitacao = p;
    return this;
  }
  withNivelRisco(n: string) {
    this.nivelRisco = n;
    return this;
  }

  build(): PluvioItem {
    return new PluvioItem(
      {
        runId: this.runId,
        regiaoId: this.regiaoId,
        imovelId: this.imovelId,
        precipitacao: this.precipitacao,
        nivelRisco: this.nivelRisco,
      },
      { id: this.id },
    );
  }
}
