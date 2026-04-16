// QW-19 — Observabilidade: inicialização do Sentry
//
// Configuração via variável de ambiente:
//   VITE_SENTRY_DSN — DSN do projeto Sentry (vazio em dev = Sentry desativado)
//
// Para ativar:
//   1. Crie um projeto em sentry.io (tipo: React)
//   2. Copie o DSN e configure em .env.production:
//        VITE_SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz
//   3. Adicione VITE_SENTRY_DSN como secret no GitHub Actions
//
// O que é capturado automaticamente:
//   - Erros JS não tratados (window.onerror)
//   - Erros de Promise não capturadas (unhandledrejection)
//   - Erros via ErrorBoundary (captureException explícito)
//   - Navegações de rota (breadcrumbs)
//
// O que NÃO é capturado (privacidade / LGPD):
//   - Dados de formulários
//   - Sessões de usuário com dados pessoais (sendDefaultPii: false)
//   - Replays de sessão (desativado)

import * as Sentry from '@sentry/react';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

  // Sem DSN configurado → Sentry inativo (dev, staging sem config)
  if (!dsn || dsn.trim() === '') return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,          // 'development' | 'production'
    release: import.meta.env.VITE_APP_VERSION,  // opcional: injetado no build

    // Taxa de amostragem: 10% das sessões em prod (ajustar conforme volume)
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Privacidade: não envia dados pessoais por padrão (LGPD)
    sendDefaultPii: false,

    // Ignora erros que não valem ruído no dashboard
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed',
      'Non-Error promise rejection',
      'Network request failed',
      /^Loading chunk \d+ failed/,              // chunk split — usuário com rede fraca
    ],

    beforeSend(event) {
      // Em dev, imprime no console em vez de enviar para o servidor
      if (import.meta.env.DEV) {
        console.warn('[Sentry DEV]', event.exception?.values?.[0]?.value);
        return null; // não envia
      }
      return event;
    },
  });
}

/** Registra exceção manualmente (use em catch blocks críticos). */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.error('[Sentry.captureError]', err, context);
    return;
  }
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
