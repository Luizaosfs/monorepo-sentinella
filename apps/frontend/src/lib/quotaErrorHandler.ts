// QW-16 — Handler centralizado de erros de quota
// Captura exceções P0001 lançadas pelos triggers do banco e retorna toast amigável.
import { toast } from 'sonner';

const QUOTA_MESSAGES: Record<string, string> = {
  quota_usuarios_excedida:      'Limite de usuários atingido para este cliente.',
  quota_levantamentos_excedida: 'Limite de levantamentos do mês atingido (incluindo carência de 50%).',
  quota_voos_excedida:          'Limite de voos do mês atingido.',
  quota_itens_excedida:         'Limite de itens do mês atingido.',
  quota_ia_excedida:            'Limite de triagens IA do mês atingido.',
};

/**
 * Verifica se o erro é de quota (ERRCODE P0001 ou mensagem contendo "quota_").
 * Se for, exibe um toast explicativo e retorna true.
 * Se não for, retorna false — o chamador deve tratar normalmente.
 *
 * @example
 * onError: (err) => { if (!handleQuotaError(err)) toast.error(err.message); }
 */
export function handleQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const code = (err as { code?: string })?.code ?? '';

  // Trigger do banco usa ERRCODE P0001 com mensagem "quota_*_excedida: ..."
  const isQuotaError = code === 'P0001' || msg.toLowerCase().includes('quota_');
  if (!isQuotaError) return false;

  // Extrai o tipo de quota da mensagem (ex: "quota_usuarios_excedida: limite=5 usado=5")
  const match = msg.match(/quota_\w+_excedida/);
  const tipoQuota = match?.[0] ?? '';
  const friendlyMsg = QUOTA_MESSAGES[tipoQuota]
    ?? 'Limite do plano atingido. Contate o administrador da plataforma.';

  toast.error(friendlyMsg, {
    description: 'Acesse Admin → Quotas para verificar o uso ou solicite ampliação do plano.',
    duration: 6000,
  });

  return true;
}
