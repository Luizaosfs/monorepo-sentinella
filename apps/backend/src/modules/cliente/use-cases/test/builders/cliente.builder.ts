import { Cliente } from '../../../entities/cliente';

export class ClienteBuilder {
  private id = 'cliente-uuid-1';
  private nome = 'Prefeitura Teste';
  private slug = 'prefeitura-teste';
  private cnpj: string | undefined = '12345678000100';
  private contatoEmail: string | undefined = 'contato@teste.gov.br';
  private contatoTelefone: string | undefined = undefined;
  private latitudeCentro: number | undefined = -20.2;
  private longitudeCentro: number | undefined = -50.9;
  private bounds: object | undefined = undefined;
  private kmzUrl: string | undefined = undefined;
  private ativo = true;
  private area: object | undefined = undefined;
  private endereco: string | undefined = undefined;
  private bairro: string | undefined = undefined;
  private cidade: string | undefined = 'Teste City';
  private estado: string | undefined = 'SP';
  private cep: string | undefined = undefined;
  private uf: string | undefined = 'SP';
  private ibgeMunicipio: string | undefined = '3550001';
  private surtoAtivo = false;
  private janelaRecorrenciaDias = 30;

  withId(id: string) {
    this.id = id;
    return this;
  }
  withNome(n: string) {
    this.nome = n;
    return this;
  }
  withSlug(s: string) {
    this.slug = s;
    return this;
  }
  withCnpj(c: string) {
    this.cnpj = c;
    return this;
  }
  withAtivo(a: boolean) {
    this.ativo = a;
    return this;
  }
  withSurtoAtivo(s: boolean) {
    this.surtoAtivo = s;
    return this;
  }
  withJanelaRecorrenciaDias(j: number) {
    this.janelaRecorrenciaDias = j;
    return this;
  }
  withCidade(c: string) {
    this.cidade = c;
    return this;
  }

  build(): Cliente {
    return new Cliente(
      {
        nome: this.nome,
        slug: this.slug,
        cnpj: this.cnpj,
        contatoEmail: this.contatoEmail,
        contatoTelefone: this.contatoTelefone,
        latitudeCentro: this.latitudeCentro,
        longitudeCentro: this.longitudeCentro,
        bounds: this.bounds,
        kmzUrl: this.kmzUrl,
        ativo: this.ativo,
        area: this.area,
        endereco: this.endereco,
        bairro: this.bairro,
        cidade: this.cidade,
        estado: this.estado,
        cep: this.cep,
        uf: this.uf,
        ibgeMunicipio: this.ibgeMunicipio,
        surtoAtivo: this.surtoAtivo,
        janelaRecorrenciaDias: this.janelaRecorrenciaDias,
      },
      { id: this.id },
    );
  }
}
