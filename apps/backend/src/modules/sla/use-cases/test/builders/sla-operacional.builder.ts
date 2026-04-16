import { SlaOperacional } from '../../../entities/sla-operacional';

export class SlaOperacionalBuilder {
  private id = 'sla-uuid-1';
  private clienteId = 'test-cliente-id';
  private itemId = 'item-uuid-1';
  private operadorId: string | undefined = undefined;
  private prioridade = 'P3';
  private slaHoras = 48;
  private inicio = new Date('2024-01-01T08:00:00Z');
  private prazoFinal = new Date('2024-01-03T08:00:00Z');
  private concluidoEm: Date | undefined = undefined;
  private status = 'pendente';
  private violado = false;
  private escalonado = false;
  private escalonadoEm: Date | undefined = undefined;
  private prioridadeOriginal: string | undefined = undefined;
  private escalonadoAutomatico = false;
  private focoRiscoId: string | undefined = undefined;
  private escaladoPor: string | undefined = undefined;
  private levantamentoItemId: string | undefined = undefined;

  withId(id: string) {
    this.id = id;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withItemId(id: string) {
    this.itemId = id;
    return this;
  }
  withOperadorId(id: string) {
    this.operadorId = id;
    return this;
  }
  withPrioridade(p: string) {
    this.prioridade = p;
    return this;
  }
  withSlaHoras(h: number) {
    this.slaHoras = h;
    return this;
  }
  withInicio(d: Date) {
    this.inicio = d;
    return this;
  }
  withPrazoFinal(d: Date) {
    this.prazoFinal = d;
    return this;
  }
  withConcluidoEm(d: Date) {
    this.concluidoEm = d;
    return this;
  }
  withStatus(s: string) {
    this.status = s;
    return this;
  }
  withViolado(v: boolean) {
    this.violado = v;
    return this;
  }
  withEscalonado(e: boolean) {
    this.escalonado = e;
    return this;
  }
  withEscalonadoEm(d: Date) {
    this.escalonadoEm = d;
    return this;
  }
  withPrioridadeOriginal(p: string) {
    this.prioridadeOriginal = p;
    return this;
  }
  withEscalonadoAutomatico(e: boolean) {
    this.escalonadoAutomatico = e;
    return this;
  }
  withFocoRiscoId(id: string) {
    this.focoRiscoId = id;
    return this;
  }
  withEscaladoPor(id: string) {
    this.escaladoPor = id;
    return this;
  }
  withLevantamentoItemId(id: string) {
    this.levantamentoItemId = id;
    return this;
  }

  build(): SlaOperacional {
    return new SlaOperacional(
      {
        clienteId: this.clienteId,
        itemId: this.itemId,
        operadorId: this.operadorId,
        prioridade: this.prioridade,
        slaHoras: this.slaHoras,
        inicio: this.inicio,
        prazoFinal: this.prazoFinal,
        concluidoEm: this.concluidoEm,
        status: this.status,
        violado: this.violado,
        escalonado: this.escalonado,
        escalonadoEm: this.escalonadoEm,
        prioridadeOriginal: this.prioridadeOriginal,
        escalonadoAutomatico: this.escalonadoAutomatico,
        focoRiscoId: this.focoRiscoId,
        escaladoPor: this.escaladoPor,
        levantamentoItemId: this.levantamentoItemId,
      },
      { id: this.id },
    );
  }
}
