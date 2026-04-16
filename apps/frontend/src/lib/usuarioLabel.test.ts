import { describe, it, expect } from 'vitest';
import { labelContaUsuario, labelResponsavelFoco } from './usuarioLabel';

describe('labelContaUsuario', () => {
  it('combina nome e email', () => {
    expect(labelContaUsuario({ nome: 'Ana', email: 'a@x.com' })).toBe('Ana · a@x.com');
  });

  it('usa só email se nome vazio', () => {
    expect(labelContaUsuario({ nome: '', email: 'a@x.com' })).toBe('a@x.com');
  });

  it('fallback Usuário', () => {
    expect(labelContaUsuario({})).toBe('Usuário');
  });
});

describe('labelResponsavelFoco', () => {
  it('retorna null sem responsável', () => {
    expect(
      labelResponsavelFoco(
        { responsavel_id: null, responsavel_nome: null },
        new Map(),
      ),
    ).toBeNull();
  });

  it('usa mapa de usuários quando há responsavel_id', () => {
    const m = new Map([['u1', { nome: 'Beto', email: 'b@x.com' }]]);
    expect(
      labelResponsavelFoco({ responsavel_id: 'u1', responsavel_nome: 'Fallback' }, m),
    ).toBe('Beto · b@x.com');
  });

  it('usa responsavel_nome quando não há cadastro', () => {
    expect(
      labelResponsavelFoco(
        { responsavel_id: null, responsavel_nome: '  João  ' },
        new Map(),
      ),
    ).toBe('João');
  });
});
