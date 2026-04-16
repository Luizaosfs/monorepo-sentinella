import { Operacao } from '../../../entities/operacao';

export class OperacaoBuilder {
  private id = 'operacao-uuid-1';
  private clienteId = 'test-cliente-id';
  private itemId: string | undefined = undefined;
  private status = 'pendente';
  private prioridade: string | undefined = 'P3';
  private responsavelId: string | undefined = undefined;
  private iniciadoEm: Date | undefined = undefined;
  private concluidoEm: Date | undefined = undefined;
  private observacao: string | undefined = undefined;
  private tipoVinculo: string | undefined = 'levantamento';
  private itemOperacionalId: string | undefined = undefined;
  private itemLevantamentoId: string | undefined = 'a0000000-0000-4000-8000-000000000001';
  private regiaoId: string | undefined = undefined;
  private focoRiscoId: string | undefined = undefined;

  withId(id: string) {
    this.id = id;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withStatus(s: string) {
    this.status = s;
    return this;
  }
  withPrioridade(p: string) {
    this.prioridade = p;
    return this;
  }
  withResponsavelId(id: string) {
    this.responsavelId = id;
    return this;
  }
  withIniciadoEm(d: Date) {
    this.iniciadoEm = d;
    return this;
  }
  withConcluidoEm(d: Date) {
    this.concluidoEm = d;
    return this;
  }
  withObservacao(o: string) {
    this.observacao = o;
    return this;
  }
  withTipoVinculo(t: string) {
    this.tipoVinculo = t;
    return this;
  }
  withItemLevantamentoId(id: string) {
    this.itemLevantamentoId = id;
    return this;
  }
  withFocoRiscoId(id: string) {
    this.focoRiscoId = id;
    return this;
  }

  build(): Operacao {
    return new Operacao(
      {
        clienteId: this.clienteId,
        itemId: this.itemId,
        status: this.status,
        prioridade: this.prioridade,
        responsavelId: this.responsavelId,
        iniciadoEm: this.iniciadoEm,
        concluidoEm: this.concluidoEm,
        observacao: this.observacao,
        tipoVinculo: this.tipoVinculo,
        itemOperacionalId: this.itemOperacionalId,
        itemLevantamentoId: this.itemLevantamentoId,
        regiaoId: this.regiaoId,
        focoRiscoId: this.focoRiscoId,
      },
      { id: this.id },
    );
  }
}
