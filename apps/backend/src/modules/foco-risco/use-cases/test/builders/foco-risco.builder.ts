import { FocoRisco, FocoRiscoStatus } from '../../../entities/foco-risco';

export class FocoRiscoBuilder {
  private id = 'foco-uuid-1';
  private clienteId = 'cliente-uuid-1';
  private status: FocoRiscoStatus = 'suspeita';
  private origemTipo = 'agente';
  private prioridade = 'P3';
  private classificacaoInicial = 'suspeito';
  private scorePrioridade = 50;
  private suspeitaEm = new Date('2024-01-01T08:00:00Z');
  private casosIds: string[] = [];
  private responsavelId: string | undefined = undefined;
  private imovelId: string | undefined = undefined;
  private regiaoId: string | undefined = undefined;
  private observacao: string | undefined = undefined;
  private inspecaoEm: Date | undefined = undefined;
  private confirmadoEm: Date | undefined = undefined;
  private resolvidoEm: Date | undefined = undefined;
  private desfecho: string | undefined = undefined;

  withId(id: string) { this.id = id; return this; }
  withClienteId(id: string) { this.clienteId = id; return this; }
  withStatus(s: FocoRiscoStatus) { this.status = s; return this; }
  withOrigemTipo(t: string) { this.origemTipo = t; return this; }
  withPrioridade(p: string) { this.prioridade = p; return this; }
  withClassificacaoInicial(c: string) { this.classificacaoInicial = c; return this; }
  withScorePrioridade(score: number) { this.scorePrioridade = score; return this; }
  withSuspeitaEm(d: Date) { this.suspeitaEm = d; return this; }
  withCasosIds(ids: string[]) { this.casosIds = ids; return this; }
  withResponsavelId(id: string) { this.responsavelId = id; return this; }
  withImovelId(id: string) { this.imovelId = id; return this; }
  withRegiaoId(id: string) { this.regiaoId = id; return this; }
  withObservacao(obs: string) { this.observacao = obs; return this; }
  withInspecaoEm(d: Date) { this.inspecaoEm = d; return this; }
  withConfirmadoEm(d: Date) { this.confirmadoEm = d; return this; }
  withResolvidoEm(d: Date) { this.resolvidoEm = d; return this; }
  withDesfecho(d: string) { this.desfecho = d; return this; }

  build(): FocoRisco {
    return new FocoRisco(
      {
        clienteId: this.clienteId,
        origemTipo: this.origemTipo,
        status: this.status,
        prioridade: this.prioridade,
        classificacaoInicial: this.classificacaoInicial,
        scorePrioridade: this.scorePrioridade,
        suspeitaEm: this.suspeitaEm,
        casosIds: this.casosIds,
        responsavelId: this.responsavelId,
        imovelId: this.imovelId,
        regiaoId: this.regiaoId,
        observacao: this.observacao,
        inspecaoEm: this.inspecaoEm,
        confirmadoEm: this.confirmadoEm,
        resolvidoEm: this.resolvidoEm,
        desfecho: this.desfecho,
      },
      { id: this.id },
    );
  }
}
