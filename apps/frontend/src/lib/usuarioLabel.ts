/** Nome + e-mail para identificar a conta (evita só “Agente” / papel genérico). */
export function labelContaUsuario(u: { nome?: string | null; email?: string | null }) {
  const nome = (u.nome ?? '').trim();
  const email = (u.email ?? '').trim();
  if (nome && email) return `${nome} · ${email}`;
  return email || nome || 'Usuário';
}

export type UsuarioLabelFields = { nome?: string | null; email?: string | null };

/** Rótulo do responsável do foco: preferir cadastro (nome · e-mail), senão `responsavel_nome` da view. */
export function labelResponsavelFoco(
  foco: { responsavel_id: string | null; responsavel_nome: string | null },
  usuarioPorId: Map<string, UsuarioLabelFields>,
): string | null {
  if (!foco.responsavel_id && !(foco.responsavel_nome ?? '').trim()) return null;
  const u = foco.responsavel_id ? usuarioPorId.get(foco.responsavel_id) : undefined;
  if (u && ((u.email ?? '').trim() || (u.nome ?? '').trim())) {
    return labelContaUsuario(u);
  }
  const fallback = (foco.responsavel_nome ?? '').trim();
  return fallback || null;
}
