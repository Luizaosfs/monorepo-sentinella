import { createFocoRiscoSchema } from '../create-foco-risco.body';

describe('createFocoRiscoSchema — origemTipo guard', () => {
  const base = { origemTipo: 'agente', classificacaoInicial: 'suspeito' };

  it("deve rejeitar origemTipo 'pluvio'", () => {
    const result = createFocoRiscoSchema.safeParse({ ...base, origemTipo: 'pluvio' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0].message;
      expect(msg).toContain("origemTipo 'pluvio' não é permitido");
    }
  });

  it.each(['agente', 'drone', 'cidadao', 'vistoria', 'levantamento'])(
    "deve aceitar origemTipo '%s'",
    (tipo) => {
      const result = createFocoRiscoSchema.safeParse({ ...base, origemTipo: tipo });
      expect(result.success).toBe(true);
    },
  );
});
