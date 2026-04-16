/**
 * OnboardingModal — tour de boas-vindas por perfil.
 *
 * Exibido no primeiro login por usuário e quando a versão do tour muda.
 * Persiste em localStorage (rápido) e no banco (duradouro via api.usuarios).
 * Máximo 4 passos por perfil.
 * Chave localStorage: `sentinella_onboarding_visto_<userId>_<versao>`
 */
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, MapPin, ClipboardList, ShieldCheck,
  Home, ClipboardCheck, AlertTriangle, Ban,
  Stethoscope, GitMerge, Search,
  Users, Settings2, BarChart2, Activity,
  ChevronRight, ChevronLeft, X,
} from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface OnboardingStep {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  tip?: string;
}

type PerfilOnboarding = 'admin' | 'supervisor' | 'agente' | 'notificador';

// ── Conteúdo por perfil ───────────────────────────────────────────────────────

const STEPS: Record<PerfilOnboarding, OnboardingStep[]> = {
  supervisor: [
    {
      icon: LayoutDashboard,
      iconBg: 'bg-blue-100 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
      title: 'Bem-vindo à Central Operacional',
      description:
        'Aqui você acompanha em tempo real os focos ativos, SLAs, agentes em campo e denúncias de cidadãos. É o seu painel de comando do dia.',
      tip: 'Acesse em Gestor → Central Operacional.',
    },
    {
      icon: AlertTriangle,
      iconBg: 'bg-orange-100 dark:bg-orange-950',
      iconColor: 'text-orange-600 dark:text-orange-400',
      title: 'Gestão de Focos de Risco',
      description:
        'Acompanhe o ciclo completo de cada foco: suspeita → triagem → inspeção → confirmado → tratamento → resolvido. Você pode transicionar status e adicionar observações.',
      tip: 'Em Gestor → Focos de Risco.',
    },
    {
      icon: MapPin,
      iconBg: 'bg-red-100 dark:bg-red-950',
      iconColor: 'text-red-600 dark:text-red-400',
      title: 'Mapa e Score Territorial',
      description:
        'Visualize os focos no mapa, filtre por prioridade e veja o score de risco de cada imóvel. Imóveis críticos aparecem em vermelho.',
      tip: 'Em Gestor → Mapa de Focos.',
    },
    {
      icon: Activity,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: 'Planejamento e Relatórios',
      description:
        'Crie planejamentos de vistoria por região, acompanhe o LIRAa por quarteirão e exporte relatórios em PDF para a vigilância epidemiológica.',
      tip: 'Disponível no menu Admin.',
    },
  ],

  agente: [
    {
      icon: Home,
      iconBg: 'bg-blue-100 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
      title: 'Bem-vindo, Agente!',
      description:
        'O Sentinella é o seu companheiro de campo. Aqui você vê os imóveis do seu dia, registra vistorias e reporta focos de dengue.',
      tip: 'Acesse em Agente → Meu Dia.',
    },
    {
      icon: ClipboardList,
      iconBg: 'bg-amber-100 dark:bg-amber-950',
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: 'Meu Dia — Lista e Mapa',
      description:
        'Veja todos os imóveis para visitar hoje na lista ou no mapa. Toque em um imóvel para abrir a ficha completa — histórico de focos, visitas e perfil.',
      tip: 'Use o mapa para planejar sua rota.',
    },
    {
      icon: ClipboardCheck,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: 'Realizar Vistoria',
      description:
        'Siga os 5 passos: responsável → sintomas → inspeção de depósitos (A1–E) → tratamento com larvicida → riscos. Funciona offline — sincroniza ao reconectar.',
      tip: 'O GPS é coletado automaticamente ao iniciar.',
    },
    {
      icon: Ban,
      iconBg: 'bg-gray-100 dark:bg-gray-900',
      iconColor: 'text-gray-600 dark:text-gray-400',
      title: 'Sem Acesso ao Imóvel',
      description:
        'Se não conseguir entrar, registre o motivo (ausente, cachorro, recusa…). Após 3 tentativas, o imóvel é marcado para sobrevoo de drone automaticamente.',
      tip: 'Botão "Registrar Sem Acesso" na ficha do imóvel.',
    },
  ],

  notificador: [
    {
      icon: Stethoscope,
      iconBg: 'bg-blue-100 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
      title: 'Bem-vindo, Notificador!',
      description:
        'Aqui você registra casos suspeitos ou confirmados de dengue, chikungunya e zika notificados na sua unidade de saúde.',
      tip: 'Acesse em Notificador → Registrar Caso.',
    },
    {
      icon: ShieldCheck,
      iconBg: 'bg-amber-100 dark:bg-amber-950',
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: 'LGPD — Sem dados pessoais',
      description:
        'Informe apenas a doença, a data, o endereço e o bairro. Não registre nome, CPF ou data de nascimento do paciente — a lei exige essa proteção.',
      tip: 'O sistema avisa se algum campo for indevido.',
    },
    {
      icon: GitMerge,
      iconBg: 'bg-red-100 dark:bg-red-950',
      iconColor: 'text-red-600 dark:text-red-400',
      title: 'Cruzamento Automático com Focos',
      description:
        'Ao salvar, o sistema cruza o endereço com focos de risco em até 300m. Se houver foco próximo, a prioridade é elevada para Crítico automaticamente.',
      tip: 'A tela de confirmação mostra quantos focos foram encontrados.',
    },
    {
      icon: Search,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: 'Acompanhe os Casos',
      description:
        'O gestor municipal pode consultar todos os casos notificados, confirmar, descartar e criar planejamentos de visita para bairros com múltiplos casos.',
      tip: 'Disponível em Admin → Casos Notificados.',
    },
  ],

  admin: [
    {
      icon: Settings2,
      iconBg: 'bg-blue-100 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
      title: 'Bem-vindo, Administrador!',
      description:
        'Você tem acesso completo à plataforma. Configure regiões, equipes, SLA, integrações e acompanhe todos os módulos operacionais.',
      tip: 'Comece pelo Dashboard para ter uma visão geral.',
    },
    {
      icon: MapPin,
      iconBg: 'bg-amber-100 dark:bg-amber-950',
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: 'Cadastro Geográfico',
      description:
        'Cadastre regiões, bairros e quarteirões do município. Essa estrutura organiza o planejamento de campo e o cálculo do LIRAa por quarteirão.',
      tip: 'Admin → Regiões / Quarteirões.',
    },
    {
      icon: Users,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: 'Gestão de Equipe e SLA',
      description:
        'Cadastre agentes, supervisores e notificadores. Configure os prazos de SLA por prioridade e os feriados municipais para cálculo correto.',
      tip: 'Admin → Usuários / SLA e Feriados.',
    },
    {
      icon: BarChart2,
      iconBg: 'bg-purple-100 dark:bg-purple-950',
      iconColor: 'text-purple-600 dark:text-purple-400',
      title: 'Relatórios e Análises',
      description:
        'Acesse LIRAa, score de surto, eficácia de tratamentos, produtividade de agentes e integração com e-SUS Notifica para envio epidemiológico.',
      tip: 'Todos os relatórios ficam no menu Admin.',
    },
  ],
};

// ── Versão do tour ────────────────────────────────────────────────────────────

/** Incrementar quando o conteúdo do tour mudar significativamente. */
export const ONBOARDING_VERSAO = '1.0';

// ── Chave localStorage ────────────────────────────────────────────────────────

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
    return true; // em caso de erro, não bloqueia
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

// ── Mapeamento papel → perfil ─────────────────────────────────────────────────

export function papelParaPerfil(papel: string | null): PerfilOnboarding | null {
  switch (papel) {
    case 'admin':        return 'admin';
    case 'supervisor':   return 'supervisor';
    case 'agente':
    case 'operador':     return 'agente'; // operador: dado legado pré-migration
    case 'notificador':  return 'notificador';
    default:             return null;
  }
}

// ── Componente ────────────────────────────────────────────────────────────────

interface OnboardingModalProps {
  userId: string;
  /** ID interno do usuário na tabela `usuarios` (para persistir no banco). */
  usuarioDbId?: string | null;
  papel: string | null;
  /** Quando true, força abertura independente do flag localStorage (re-abertura via "Como usar"). */
  forceOpen?: boolean;
  onClose?: () => void;
}

export function OnboardingModal({ userId, usuarioDbId, papel, forceOpen, onClose }: OnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const perfil = papelParaPerfil(papel);
  const steps = perfil ? STEPS[perfil] : null;

  useEffect(() => {
    if (!userId || !steps) return;
    if (forceOpen || !jaViuOnboarding(userId)) {
      setStep(0);
      setOpen(true);
    }
  }, [userId, steps, forceOpen]);

  function fechar() {
    marcarOnboardingVisto(userId);
    setOpen(false);
    onClose?.();
    // Persiste no banco de forma assíncrona — sem bloquear a UI
    if (usuarioDbId) {
      api.usuarios.marcarOnboardingConcluido(usuarioDbId, ONBOARDING_VERSAO).catch(() => {
        // silencioso — localStorage já garantiu a flag
      });
    }
  }

  function proximo() {
    if (!steps) return;
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      fechar();
    }
  }

  function anterior() {
    setStep((s) => Math.max(0, s - 1));
  }

  if (!steps || !open) return null;

  const atual = steps[step];
  const Icon = atual.icon;
  const isUltimo = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent
        className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl"
        // Remove o X padrão do shadcn — usamos o nosso
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Radix: DialogTitle como primeiro filho de Content (acessibilidade) */}
        <DialogTitle className="sr-only">
          Tour de boas-vindas — {atual.title}
        </DialogTitle>
        {/* Header colorido */}
        <div className={cn('relative flex flex-col items-center pt-10 pb-8 px-8', atual.iconBg)}>
          <button
            onClick={fechar}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:bg-black/10 transition-colors"
            aria-label="Pular tour"
          >
            <X className="w-4 h-4" />
          </button>

          <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-white/70 dark:bg-black/20 shadow-sm')}>
            <Icon className={cn('w-8 h-8', atual.iconColor)} />
          </div>

          <h2 className="text-lg font-bold text-foreground text-center leading-snug">
            {atual.title}
          </h2>
        </div>

        {/* Corpo */}
        <div className="px-8 py-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed text-center">
            {atual.description}
          </p>

          {atual.tip && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
              <span className="text-xs font-bold text-primary shrink-0 mt-0.5">Dica</span>
              <p className="text-xs text-muted-foreground leading-relaxed">{atual.tip}</p>
            </div>
          )}

          {/* Dots de progresso */}
          <div className="flex justify-center gap-1.5 pt-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i === step
                    ? 'w-5 h-1.5 bg-primary'
                    : 'w-1.5 h-1.5 bg-muted-foreground/30',
                )}
              />
            ))}
          </div>
        </div>

        {/* Rodapé com botões */}
        <div className="flex items-center justify-between px-8 pb-7 gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={step === 0 ? fechar : anterior}
          >
            {step === 0 ? 'Pular' : (
              <><ChevronLeft className="w-4 h-4 mr-1" />Anterior</>
            )}
          </Button>

          <Button
            size="sm"
            className="gap-1 font-semibold px-5"
            onClick={proximo}
          >
            {isUltimo ? 'Começar!' : (
              <>Próximo <ChevronRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
