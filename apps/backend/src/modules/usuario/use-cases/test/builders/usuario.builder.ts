import { PapelApp, Usuario } from '../../../entities/usuario';

export class UsuarioBuilder {
  private id = 'usuario-uuid-1';
  private authId: string | undefined = 'auth-uuid-1';
  private nome = 'Agente Teste';
  private email = 'agente@teste.gov.br';
  private clienteId: string | undefined = 'test-cliente-id';
  private ativo = true;
  private onboardingConcluido = false;
  private papeis: PapelApp[] = ['agente'];

  withId(id: string) {
    this.id = id;
    return this;
  }
  withAuthId(id: string) {
    this.authId = id;
    return this;
  }
  withNome(n: string) {
    this.nome = n;
    return this;
  }
  withEmail(e: string) {
    this.email = e;
    return this;
  }
  withClienteId(id: string) {
    this.clienteId = id;
    return this;
  }
  withAtivo(a: boolean) {
    this.ativo = a;
    return this;
  }
  withPapeis(p: PapelApp[]) {
    this.papeis = p;
    return this;
  }

  build(): Usuario {
    return new Usuario(
      {
        authId: this.authId,
        nome: this.nome,
        email: this.email,
        clienteId: this.clienteId,
        ativo: this.ativo,
        onboardingConcluido: this.onboardingConcluido,
        papeis: this.papeis,
      },
      { id: this.id },
    );
  }
}
