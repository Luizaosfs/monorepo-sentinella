import { autoClassificarFoco } from '../auto-classificar-foco';

describe('autoClassificarFoco (paridade fn_auto_classificar_foco)', () => {
  it('drone → foco (ignora classificacaoInicial passada)', () => {
    expect(
      autoClassificarFoco({ origemTipo: 'drone', classificacaoInicial: 'caso_notificado' }),
    ).toBe('foco');
  });

  it('pluvio → risco (ignora classificacaoInicial passada)', () => {
    expect(
      autoClassificarFoco({ origemTipo: 'pluvio', classificacaoInicial: 'suspeito' }),
    ).toBe('risco');
  });

  it('cidadao sem classificacaoInicial → suspeito (default)', () => {
    expect(autoClassificarFoco({ origemTipo: 'cidadao' })).toBe('suspeito');
  });

  it('agente + classificacaoInicial=caso_notificado → preserva caso_notificado', () => {
    expect(
      autoClassificarFoco({ origemTipo: 'agente', classificacaoInicial: 'caso_notificado' }),
    ).toBe('caso_notificado');
  });
});
