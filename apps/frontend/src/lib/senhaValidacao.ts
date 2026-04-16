/**
 * Validação de senha forte — regra canônica usada no onboarding e criação de usuários.
 * Mín. 8 chars | 1 maiúscula | 1 número | 1 especial
 */
export interface SenhaValidationResult {
  valid: boolean;
  error: string | null;
}

export function validateSenhaForte(senha: string): SenhaValidationResult {
  if (!senha || senha.length < 8)
    return { valid: false, error: 'A senha deve ter no mínimo 8 caracteres' };
  if (!/[A-Z]/.test(senha))
    return { valid: false, error: 'A senha deve conter pelo menos uma letra maiúscula' };
  if (!/[0-9]/.test(senha))
    return { valid: false, error: 'A senha deve conter pelo menos um número' };
  if (!/[^A-Za-z0-9]/.test(senha))
    return { valid: false, error: 'A senha deve conter pelo menos um caractere especial (!@#$%...)' };
  return { valid: true, error: null };
}
