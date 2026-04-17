/** Versão do tour — incrementar quando o conteúdo mudar significativamente. */
export const ONBOARDING_VERSAO = '1.0';

function getOnboardingKey(userId: string, versao = ONBOARDING_VERSAO) {
  return `sentinella_onboarding_visto_${userId}_${versao}`;
}

export function marcarOnboardingVisto(userId: string) {
  try {
    localStorage.setItem(getOnboardingKey(userId), '1');
  } catch {
    // silencioso
  }
}

export function jaViuOnboarding(userId: string): boolean {
  try {
    return localStorage.getItem(getOnboardingKey(userId)) === '1';
  } catch {
    return true;
  }
}

/** Apaga o flag local para que o modal reapareça — usado em "Como usar". */
export function resetarOnboarding(userId: string) {
  try {
    localStorage.removeItem(getOnboardingKey(userId));
  } catch {
    // silencioso
  }
}

export type PerfilOnboarding = 'admin' | 'supervisor' | 'agente' | 'notificador';

export function papelParaPerfil(papel: string | null): PerfilOnboarding | null {
  switch (papel) {
    case 'admin':        return 'admin';
    case 'supervisor':   return 'supervisor';
    case 'agente':
    case 'operador':     return 'agente';
    case 'notificador':  return 'notificador';
    default:             return null;
  }
}
