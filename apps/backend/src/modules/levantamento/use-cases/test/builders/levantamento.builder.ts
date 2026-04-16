import { Levantamento } from '../../../entities/levantamento';

export class LevantamentoBuilder {
  private id = 'lev-uuid-1';
  private clienteId = 'test-cliente-id';
  private usuarioId = 'test-user-id';
  private planejamentoId: string | undefined = undefined;
  private cicloId: string | undefined = undefined;
  private idDrone: string | undefined = undefined;
  private titulo: string | undefined = 'Levantamento Teste';
  private tipoEntrada: string | undefined = 'manual';
  private statusProcessamento = 'aguardando';
  private totalItens = 0;
  private observacao: string | undefined = undefined;
  private concluidoEm: Date | undefined = undefined;

  withId(id: string) {
    this.id = id;
    return this;
  }

  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }

  withUsuarioId(id: string) {
    this.usuarioId = id;
    return this;
  }

  withPlanejamentoId(id: string) {
    this.planejamentoId = id;
    return this;
  }

  withCicloId(id: string) {
    this.cicloId = id;
    return this;
  }

  withIdDrone(id: string) {
    this.idDrone = id;
    return this;
  }

  withTitulo(t: string) {
    this.titulo = t;
    return this;
  }

  withTipoEntrada(t: string) {
    this.tipoEntrada = t;
    return this;
  }

  withStatusProcessamento(s: string) {
    this.statusProcessamento = s;
    return this;
  }

  withTotalItens(n: number) {
    this.totalItens = n;
    return this;
  }

  withObservacao(o: string) {
    this.observacao = o;
    return this;
  }

  withConcluidoEm(d: Date) {
    this.concluidoEm = d;
    return this;
  }

  build(): Levantamento {
    return new Levantamento(
      {
        clienteId: this.clienteId,
        usuarioId: this.usuarioId,
        planejamentoId: this.planejamentoId,
        cicloId: this.cicloId,
        idDrone: this.idDrone,
        titulo: this.titulo,
        tipoEntrada: this.tipoEntrada,
        statusProcessamento: this.statusProcessamento,
        totalItens: this.totalItens,
        observacao: this.observacao,
        concluidoEm: this.concluidoEm,
      },
      { id: this.id },
    );
  }
}
