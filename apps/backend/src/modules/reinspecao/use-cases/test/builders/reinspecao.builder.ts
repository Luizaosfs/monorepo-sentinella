import { Reinspecao, ReinspecaoStatus } from '../../../entities/reinspecao';

export class ReinspecaoBuilder {
  private id = 'reinspecao-uuid-1';
  private clienteId = 'test-cliente-id';
  private focoRiscoId = 'foco-uuid-1';
  private status: ReinspecaoStatus = 'pendente';
  private tipo = 'verificacao';
  private origem = 'manual';
  private dataPrevista = new Date('2024-07-01');
  private dataRealizada: Date | undefined = undefined;
  private responsavelId: string | undefined = undefined;
  private observacao: string | undefined = undefined;
  private resultado: string | undefined = undefined;
  private criadoPor: string | undefined = 'test-user-id';
  private canceladoPor: string | undefined = undefined;
  private motivoCancelamento: string | undefined = undefined;

  withId(id: string) {
    this.id = id;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withFocoRiscoId(id: string) {
    this.focoRiscoId = id;
    return this;
  }
  withStatus(s: ReinspecaoStatus) {
    this.status = s;
    return this;
  }
  withTipo(t: string) {
    this.tipo = t;
    return this;
  }
  withOrigem(o: string) {
    this.origem = o;
    return this;
  }
  withDataPrevista(d: Date) {
    this.dataPrevista = d;
    return this;
  }
  withDataRealizada(d: Date) {
    this.dataRealizada = d;
    return this;
  }
  withResponsavelId(id: string) {
    this.responsavelId = id;
    return this;
  }
  withResultado(r: string) {
    this.resultado = r;
    return this;
  }
  withCriadoPor(id: string) {
    this.criadoPor = id;
    return this;
  }

  build(): Reinspecao {
    return new Reinspecao(
      {
        clienteId: this.clienteId,
        focoRiscoId: this.focoRiscoId,
        status: this.status,
        tipo: this.tipo,
        origem: this.origem,
        dataPrevista: this.dataPrevista,
        dataRealizada: this.dataRealizada,
        responsavelId: this.responsavelId,
        observacao: this.observacao,
        resultado: this.resultado,
        criadoPor: this.criadoPor,
        canceladoPor: this.canceladoPor,
        motivoCancelamento: this.motivoCancelamento,
      },
      { id: this.id },
    );
  }
}
