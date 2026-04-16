import { useClienteQuotas } from '@/hooks/queries/useClienteQuotas';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { AlertTriangle, Info, X } from 'lucide-react';
import { useState } from 'react';
import { ClienteUsoMensal } from '@/types/database';
import type { TenantStatus } from '@/hooks/useClienteAtivo';

/**
 * Banners de estado da conta e uso de quota.
 *
 * Duas camadas (renderizadas independentemente):
 *   1. TenantStatusBanner — estado do contrato SaaS (não dismissable quando bloqueado)
 *   2. QuotaUsageBanner   — uso ≥70% de alguma métrica mensal (dismissable)
 *
 * Aparece abaixo do OfflineBanner.
 */
export function QuotaBanner() {
  const { clienteId, tenantStatus } = useClienteAtivo();
  const { uso } = useClienteQuotas(clienteId);
  const [quotaDismissed, setQuotaDismissed] = useState(false);
  const [trialDismissed, setTrialDismissed] = useState(false);

  return (
    <>
      <TenantStatusBanner
        tenantStatus={tenantStatus}
        trialDismissed={trialDismissed}
        onDismissTrial={() => setTrialDismissed(true)}
      />
      {!quotaDismissed && uso.data && (
        <QuotaUsageBanner
          uso={uso.data}
          onDismiss={() => setQuotaDismissed(true)}
        />
      )}
    </>
  );
}

// ── TenantStatusBanner ────────────────────────────────────────────────────────

interface TenantStatusBannerProps {
  tenantStatus: TenantStatus | null;
  trialDismissed: boolean;
  onDismissTrial: () => void;
}

function TenantStatusBanner({ tenantStatus, trialDismissed, onDismissTrial }: TenantStatusBannerProps) {
  if (!tenantStatus) return null;
  const { status, isBlocked, isInadimplente, isTrialing, trialDaysLeft } = tenantStatus;

  // Tenant bloqueado — vermelho, não dismissable
  if (isBlocked) {
    const msg =
      status === 'cancelado'  ? 'Contrato cancelado — acesso em modo somente-leitura.' :
      status === 'trial'      ? 'Trial expirado — acesso bloqueado.' :
                                'Conta suspensa — acesso bloqueado.';
    return (
      <div className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-destructive text-destructive-foreground shadow-md">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="flex-1">{msg} Contacte o suporte para reactivar.</span>
      </div>
    );
  }

  // Inadimplente — amarelo, não dismissable
  if (isInadimplente) {
    return (
      <div className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2 text-sm font-medium bg-yellow-400 text-yellow-950 shadow-md">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="flex-1">Pagamento em atraso — o acesso será suspenso em breve. Regularize a situação para evitar interrupções.</span>
      </div>
    );
  }

  // Trial ≤7 dias — laranja, não dismissable
  if (isTrialing && trialDaysLeft !== null && trialDaysLeft <= 7) {
    return (
      <div className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 text-orange-950 shadow-md">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="flex-1">
          Trial termina em <strong>{trialDaysLeft === 0 ? 'menos de 1 dia' : `${trialDaysLeft} ${trialDaysLeft === 1 ? 'dia' : 'dias'}`}</strong> — entre em contacto para contratar um plano.
        </span>
      </div>
    );
  }

  // Trial ativo com mais de 7 dias — azul info, dismissable
  if (isTrialing && !trialDismissed && trialDaysLeft !== null) {
    return (
      <div className="sticky top-0 z-40 flex items-center gap-2 px-4 py-2 text-sm bg-blue-100 text-blue-900 shadow-md">
        <Info className="w-4 h-4 shrink-0" />
        <span className="flex-1">Trial ativo — <strong>{trialDaysLeft} dias restantes</strong>.</span>
        <button
          type="button"
          aria-label="Fechar"
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          onClick={onDismissTrial}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}

// ── QuotaUsageBanner ──────────────────────────────────────────────────────────

interface QuotaUsageBannerProps {
  uso: ClienteUsoMensal;
  onDismiss: () => void;
}

function QuotaUsageBanner({ uso, onDismiss }: QuotaUsageBannerProps) {
  const alertas = buildAlertas(uso);
  if (alertas.length === 0) return null;

  const isExcedido = alertas.some((a) => a.pct >= 1);

  return (
    <div
      className={`sticky top-0 z-40 flex items-center gap-2 px-4 py-2 text-sm font-medium shadow-md ${
        isExcedido
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-orange-500 text-orange-950'
      }`}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        {isExcedido ? 'Quota excedida: ' : 'Quota próxima do limite: '}
        {alertas.map((a, i) => (
          <span key={a.label}>
            {i > 0 && ', '}
            <strong>{a.label}</strong> ({Math.round(a.pct * 100)}%)
          </span>
        ))}
      </span>
      <button
        type="button"
        aria-label="Fechar"
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        onClick={onDismiss}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

interface Alerta {
  label: string;
  pct: number;
}

function buildAlertas(uso: ClienteUsoMensal): Alerta[] {
  const alertas: Alerta[] = [];

  const check = (usado: number, limite: number | null | undefined, label: string) => {
    if (limite != null && limite > 0) {
      const pct = usado / limite;
      if (pct >= 0.7) alertas.push({ label, pct });
    }
  };

  check(uso.voos_mes_usado,          uso.voos_mes_limite,          'Voos');
  check(uso.levantamentos_mes_usado, uso.levantamentos_mes_limite, 'Levantamentos');
  check(uso.itens_mes_usado,         uso.itens_mes_limite,         'Itens');
  check(uso.usuarios_ativos_usado,   uso.usuarios_ativos_limite,   'Usuários');
  // QW-16 — novas métricas
  check(uso.vistorias_mes_usado,     uso.vistorias_mes_limite,     'Vistorias');
  check(uso.ia_calls_mes_usado,      uso.ia_calls_mes_limite,      'Triagens IA');
  check(uso.storage_gb_usado,        uso.storage_gb_limite,        'Storage');

  return alertas;
}
