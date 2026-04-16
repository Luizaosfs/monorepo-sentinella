/**
 * Gerenciamento de assinaturas Web Push no cliente.
 *
 * ## Setup de VAPID (executar uma vez):
 *   npx web-push generate-vapid-keys
 *
 * - VITE_VAPID_PUBLIC_KEY → .env (frontend)
 * - VAPID_PRIVATE_KEY     → Supabase Edge Function secret
 * - VAPID_PUBLIC_KEY      → Supabase Edge Function secret (mesma chave)
 *
 * ## Uso:
 *   import { subscribeUserToPush, unsubscribeUserFromPush } from '@/lib/webPush';
 */

import { api } from '@/services/api';

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** localStorage key que indica que o usuário já teve push ativo anteriormente. */
const PUSH_SUBSCRIBED_KEY = 'sentinella_push_subscribed';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Inscreve o usuário no Web Push e salva a assinatura no Supabase.
 * No-op silencioso se:
 *  - service worker não disponível
 *  - VAPID_PUBLIC_KEY não configurada
 *  - permissão negada
 */
/**
 * Inscreve o usuário no Web Push e salva a assinatura no Supabase.
 * Retorna `true` se uma nova assinatura foi criada em substituição a uma anterior
 * (indica que o endpoint foi removido pelo servidor de push — QW-09 Correção 4c).
 */
export async function subscribeUserToPush(usuarioId: string, clienteId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (!VAPID_PUBLIC_KEY) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // QW-09 Correção 4c: detectar endpoint removido externamente
    const hadSubscription = localStorage.getItem(PUSH_SUBSCRIBED_KEY) === 'true';
    const isResubscribed = !subscription && hadSubscription;

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON() as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    await api.pushSubscriptions.upsert({
      usuario_id: usuarioId,
      cliente_id: clienteId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });

    localStorage.setItem(PUSH_SUBSCRIBED_KEY, 'true');
    return isResubscribed;
  } catch {
    // Falha silenciosa — push é funcionalidade adicional, não crítica
    return false;
  }
}

/**
 * Remove a assinatura push do usuário atual (ex: logout, revogar permissão).
 */
export async function unsubscribeUserFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await api.pushSubscriptions.removeByEndpoint(subscription.endpoint);
    await subscription.unsubscribe();
  } catch {
    // Silencioso
  }
}
