import { DistribuicaoQuarteirao, Quarteirao } from '../../../entities/quarteirao';

export class QuarteiraoBuilder {
  private id = 'quarteirao-uuid-1';
  private clienteId = 'test-cliente-id';
  private bairroId: string | undefined = 'regiao-uuid-1';
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
    this.bairroId = id;
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
        bairroId: this.bairroId,
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
  private cicloId = 'ciclo-uuid-1';
  private quadraId = 'quadra-uuid-1';
  private agenteId = 'agente-uuid-1';
  private bairroId: string | undefined = 'regiao-uuid-1';

  withId(id: string) {
    this.id = id;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withCicloId(id: string) {
    this.cicloId = id;
    return this;
  }
  withQuadraId(id: string) {
    this.quadraId = id;
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
        cicloId:   this.cicloId,
        quadraId:  this.quadraId,
        agenteId:  this.agenteId,
        bairroId:  this.bairroId,
      },
      { id: this.id },
    );
  }
}
