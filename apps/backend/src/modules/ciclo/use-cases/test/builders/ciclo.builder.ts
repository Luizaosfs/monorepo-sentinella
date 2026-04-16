import { Ciclo } from '../../../entities/ciclo';

export class CicloBuilder {
  private id = 'ciclo-uuid-1';
  private clienteId = 'test-cliente-id';
  private numero = 1;
  private ano = 2024;
  private status = 'ativo';
  private dataInicio = new Date('2024-01-01');
  private dataFimPrevista = new Date('2024-02-29');
  private dataFechamento: Date | undefined = undefined;
  private metaCoberturaPct: number | undefined = 100;
  private snapshotFechamento: Record<string, unknown> | undefined = undefined;
  private observacaoAbertura: string | undefined = undefined;
  private observacaoFechamento: string | undefined = undefined;
  private abertoPor: string | undefined = 'test-user-id';
  private fechadoPor: string | undefined = undefined;

  withId(id: string) {
    this.id = id;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withNumero(n: number) {
    this.numero = n;
    return this;
  }
  withAno(a: number) {
    this.ano = a;
    return this;
  }
  withStatus(s: string) {
    this.status = s;
    return this;
  }
  withDataInicio(d: Date) {
    this.dataInicio = d;
    return this;
  }
  withDataFimPrevista(d: Date) {
    this.dataFimPrevista = d;
    return this;
  }
  withDataFechamento(d: Date) {
    this.dataFechamento = d;
    return this;
  }
  withMetaCoberturaPct(m: number) {
    this.metaCoberturaPct = m;
    return this;
  }
  withSnapshotFechamento(s: Record<string, unknown>) {
    this.snapshotFechamento = s;
    return this;
  }
  withObservacaoAbertura(o: string) {
    this.observacaoAbertura = o;
    return this;
  }
  withObservacaoFechamento(o: string) {
    this.observacaoFechamento = o;
    return this;
  }
  withAbertoPor(u: string) {
    this.abertoPor = u;
    return this;
  }
  withFechadoPor(u: string) {
    this.fechadoPor = u;
    return this;
  }

  build(): Ciclo {
    return new Ciclo(
      {
        clienteId: this.clienteId,
        numero: this.numero,
        ano: this.ano,
        status: this.status,
        dataInicio: this.dataInicio,
        dataFimPrevista: this.dataFimPrevista,
        dataFechamento: this.dataFechamento,
        metaCoberturaPct: this.metaCoberturaPct,
        snapshotFechamento: this.snapshotFechamento,
        observacaoAbertura: this.observacaoAbertura,
        observacaoFechamento: this.observacaoFechamento,
        abertoPor: this.abertoPor,
        fechadoPor: this.fechadoPor,
      },
      { id: this.id },
    );
  }
}
