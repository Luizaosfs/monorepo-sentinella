import { PlanoAcao } from '../../../entities/plano-acao';

export class PlanoAcaoBuilder {
  private id = 'plano-uuid-1';
  private clienteId = 'test-cliente-id';
  private label = 'Eliminação mecânica';
  private descricao: string | undefined = 'Remoção manual do foco';
  private tipoItem: string | undefined = 'criadouro';
  private ativo = true;
  private ordem = 0;

  withId(id: string) {
    this.id = id;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withLabel(l: string) {
    this.label = l;
    return this;
  }
  withDescricao(d: string) {
    this.descricao = d;
    return this;
  }
  withTipoItem(t: string) {
    this.tipoItem = t;
    return this;
  }
  withAtivo(a: boolean) {
    this.ativo = a;
    return this;
  }
  withOrdem(o: number) {
    this.ordem = o;
    return this;
  }

  build(): PlanoAcao {
    return new PlanoAcao(
      {
        clienteId: this.clienteId,
        label: this.label,
        descricao: this.descricao,
        tipoItem: this.tipoItem,
        ativo: this.ativo,
        ordem: this.ordem,
      },
      { id: this.id },
    );
  }
}
