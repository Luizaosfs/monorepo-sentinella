import { Vistoria } from '../../../entities/vistoria';

export class VistoriaBuilder {
  private id = '00000000-0000-4000-8000-0000000000a1';
  private clienteId = '00000000-0000-4000-8000-000000000001';
  private imovelId = '00000000-0000-4000-8000-000000000002';
  private agenteId = '00000000-0000-4000-8000-000000000003';
  private ciclo = 1;
  private tipoAtividade = 'LI';
  private dataVisita = new Date('2024-06-01T10:00:00Z');
  private status = 'pendente';

  withId(id: string) {
    this.id = id;
    return this;
  }

  withClienteId(clienteId: string) {
    this.clienteId = clienteId;
    return this;
  }

  withAgenteId(agenteId: string) {
    this.agenteId = agenteId;
    return this;
  }

  withImovelId(imovelId: string) {
    this.imovelId = imovelId;
    return this;
  }

  withStatus(status: string) {
    this.status = status;
    return this;
  }

  build(): Vistoria {
    return new Vistoria(
      {
        clienteId: this.clienteId,
        imovelId: this.imovelId,
        agenteId: this.agenteId,
        ciclo: this.ciclo,
        tipoAtividade: this.tipoAtividade,
        dataVisita: this.dataVisita,
        status: this.status,
        gravidas: false,
        idosos: false,
        criancas7anos: false,
        acessoRealizado: true,
        pendenteAssinatura: false,
        pendenteFoto: false,
        origemOffline: false,
        consolidacaoIncompleta: false,
      },
      { id: this.id },
    );
  }
}
