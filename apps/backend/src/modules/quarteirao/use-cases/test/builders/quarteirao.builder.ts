import { DistribuicaoQuarteirao, Quarteirao } from '../../../entities/quarteirao';

export class QuarteiraoBuilder {
  private id = 'quarteirao-uuid-1';
  private clienteId = 'test-cliente-id';
  private regiaoId: string | undefined = 'regiao-uuid-1';
  private codigo = 'Q001';
  private bairro: string | undefined = 'Centro';
  private ativo = true;

  withId(id: string) {
    this.id = id;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withRegiaoId(id: string) {
    this.regiaoId = id;
    return this;
  }
  withCodigo(c: string) {
    this.codigo = c;
    return this;
  }
  withBairro(b: string) {
    this.bairro = b;
    return this;
  }
  withAtivo(a: boolean) {
    this.ativo = a;
    return this;
  }

  build(): Quarteirao {
    return new Quarteirao(
      {
        clienteId: this.clienteId,
        regiaoId: this.regiaoId,
        codigo: this.codigo,
        bairro: this.bairro,
        ativo: this.ativo,
      },
      { id: this.id },
    );
  }
}

export class DistribuicaoBuilder {
  private id = 'dist-uuid-1';
  private clienteId = 'test-cliente-id';
  private ciclo = 1;
  private quarteirao = 'Q001';
  private agenteId = 'agente-uuid-1';
  private regiaoId: string | undefined = 'regiao-uuid-1';

  withId(id: string) {
    this.id = id;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withCiclo(c: number) {
    this.ciclo = c;
    return this;
  }
  withQuarteirao(q: string) {
    this.quarteirao = q;
    return this;
  }
  withAgenteId(id: string) {
    this.agenteId = id;
    return this;
  }

  build(): DistribuicaoQuarteirao {
    return new DistribuicaoQuarteirao(
      {
        clienteId: this.clienteId,
        ciclo: this.ciclo,
        quarteirao: this.quarteirao,
        agenteId: this.agenteId,
        regiaoId: this.regiaoId,
      },
      { id: this.id },
    );
  }
}
