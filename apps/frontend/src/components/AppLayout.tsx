import { Outlet, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { PAPEL_LABEL } from '@/lib/labels';
import {
  LayoutDashboard,
  ClipboardList,
  Map as MapIcon,
  LogOut,
  Menu,
  Moon,
  Sun,
  ShieldCheck,
  MoreHorizontal,
  Building2,
  Users,
  CalendarRange,
  ChevronDown,
  Timer,
  MapPin,
  Plane,
  CloudRain,
  FileSpreadsheet,
  ClipboardCheck,
  User,
  Gauge,
  GitCompare,
  Activity,
  Globe2,
  Megaphone,
  Stethoscope,
  Home,
  Plug,
  BarChart2,
  TrendingUp,
  Eye,
  EyeOff,
  Radio,
  Target,
  HeartPulse,
  ListTodo,
  Filter,
  Settings2,
  RotateCcw,
  BookOpen,
  Search,
} from 'lucide-react';
import { IconDrone } from '@/components/icons/IconDrone';
import { OfflineBanner } from '@/components/OfflineBanner';
import { QuotaBanner } from '@/components/QuotaBanner';
import { OnboardingModal } from '@/components/OnboardingModal';
import { resetarOnboarding } from '@/lib/onboarding';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { drainQueue } from '@/lib/offlineQueue';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { QuotaAlertBadge } from '@/components/QuotaAlertBadge';
import { useTheme } from '@/hooks/useTheme';
import { useModoAnalitico } from '@/hooks/useModoAnalitico';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { LogoIcon } from '@/components/LogoIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SlaAlertBell } from '@/components/SlaAlertBell';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAlertasRetorno } from '@/hooks/queries/useAlertasRetorno';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Hierarquia: 1-Administrador (suporte SaaS) | 2-Supervisor (admin do cliente) | 3-Cliente | 4-Operador (portal próprio)

// ─── SUPERVISOR / ADMIN: navegação principal ──────────────────────────────────
const baseNavItems = [
  { to: '/gestor/central',  label: 'Central do Dia',   icon: Radio },
  { to: '/gestor/triagem',  label: 'Triagem de Focos', icon: Filter },
  { to: '/gestor/focos',    label: 'Focos de Risco',   icon: Target },
  { to: '/gestor/mapa',     label: 'Mapa de Focos',    icon: MapIcon },
  { to: '/levantamentos',   label: 'Levantamentos',    icon: ClipboardList },
];

// ─── AGENTE DE ENDEMIAS ───────────────────────────────────────────────────────
// MENU_OFICIAL: Meu Dia → Registrar Vistoria → Minhas Vistorias → Mapa.
const operadorNavItems = [
  { to: '/agente/hoje',            label: 'Meu Dia',            icon: Home },
  { to: '/agente/imoveis',         label: 'Registrar Vistoria', icon: ClipboardCheck },
  { to: '/agente/levantamentos',   label: 'Minhas Vistorias',   icon: ClipboardList },
  { to: '/agente/mapa',            label: 'Mapa',               icon: MapIcon },
];

// ─── ANALISTA REGIONAL ────────────────────────────────────────────────────────
const analistaRegionalNavItems = [
  { to: '/regional/dashboard',           label: 'Dashboard Regional', icon: BarChart2 },
  { to: '/gestor/dashboard-analitico',   label: 'Dashboard Analítico', icon: LayoutDashboard },
  { to: '/gestor/relatorios',            label: 'Relatórios',          icon: FileSpreadsheet },
];

// ─── NOTIFICADOR ──────────────────────────────────────────────────────────────
// Q7: Novo Caso aparece primeiro (fluxo principal do notificador).
const notificadorNavItems = [
  { to: '/notificador/registrar', label: 'Novo Caso',           icon: Stethoscope },
  { to: '/notificador',           label: 'Meus Casos',          icon: ClipboardList },
  { to: '/notificador/consultar', label: 'Consultar Protocolo', icon: BookOpen },
];

// ─── ADMIN DE PLATAFORMA: navegação focada na gestão da plataforma SaaS ───────
// Q7: admin não acessa fluxo operacional (Central/Focos/Mapa = domínio do supervisor).
const adminMonitorNavItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

// ─── GRUPOS DO SIDEBAR (supervisor/admin) ─────────────────────────────────────
const grupoPlnejamento = [
  { to: '/gestor/planejamentos',           label: 'Planejamentos',              icon: CalendarRange,  adminOnly: false },
  { to: '/gestor/ciclos',                  label: 'Gestão de Ciclos',           icon: CalendarRange,  adminOnly: false },
  { to: '/gestor/distribuicao-quarteirao', label: 'Distribuição de Quarteirão', icon: MapIcon,        adminOnly: false },
  { to: '/gestor/operacoes',               label: 'Operações',                  icon: ClipboardCheck, adminOnly: false },
  { to: '/gestor/historico-atendimento',   label: 'Histórico de Atendimento',   icon: User,           adminOnly: false },
];

const grupoSaudeVigilancia = [
  { to: '/gestor/casos',         label: 'Casos Notificados',   icon: Stethoscope, adminOnly: false },
  { to: '/gestor/liraa',         label: 'Relatório LIRAa',     icon: BarChart2,   adminOnly: false },
  { to: '/gestor/score-surto',   label: 'Score de Surto',      icon: TrendingUp,  adminOnly: false },
  { to: '/gestor/reincidencia',  label: 'Reincidência',        icon: RotateCcw,   adminOnly: false },
  { to: '/admin/canal-cidadao',  label: 'Canal Cidadão',       icon: Megaphone,   adminOnly: true  },
  { to: '/gestor/integracoes',   label: 'Integrações (e-SUS)', icon: Plug,        adminOnly: false },
];

const grupoInteligencia = [
  { to: '/gestor/dashboard-analitico',   label: 'Dashboard Analítico',      icon: LayoutDashboard, adminOnly: false },
  { to: '/gestor/relatorios',            label: 'Relatórios Executivos',     icon: FileSpreadsheet, adminOnly: false },
  { to: '/gestor/mapa-comparativo',      label: 'Mapa Antes/Depois',        icon: GitCompare,  adminOnly: false },
  { to: '/gestor/heatmap-temporal',      label: 'Heatmap Temporal',         icon: Activity,    adminOnly: false },
  { to: '/gestor/produtividade-agentes', label: 'Produtividade',            icon: Users,       adminOnly: false },
  { to: '/gestor/eficacia-tratamentos',  label: 'Eficácia de Tratamentos',  icon: TrendingUp,  adminOnly: false },
  { to: '/gestor/executivo',             label: 'Painel Executivo',         icon: Gauge,       adminOnly: false },
  { to: '/gestor/supervisor-tempo-real', label: 'Supervisão em Tempo Real', icon: Radio,       adminOnly: false },
];

const grupoRiscoClima = [
  { to: '/gestor/pluvio-risco',       label: 'Risco Pluviométrico', icon: CloudRain,       adminOnly: false },
  { to: '/gestor/pluvio-operacional', label: 'Tabela Operacional',  icon: FileSpreadsheet, adminOnly: false },
  { to: '/admin/risk-policy',         label: 'Política de Risco',   icon: ShieldCheck,     adminOnly: true  },
];

const grupoConfiguracoes = [
  { to: '/gestor/regioes',               label: 'Regiões',                    icon: MapPin,         adminOnly: false },
  { to: '/admin/usuarios',              label: 'Usuários da Plataforma',      icon: Users,          adminOnly: true  },
  { to: '/operador/usuarios',            label: 'Agentes de Campo',           icon: Users,          adminOnly: false },
  { to: '/gestor/unidades-saude',        label: 'Unidades de Saúde',          icon: Building2,      adminOnly: false },
  { to: '/gestor/imoveis',               label: 'Imóveis',                    icon: Home,           adminOnly: false },
  { to: '/gestor/importar-imoveis',      label: 'Importar Imóveis (CSV/XLSX)', icon: FileSpreadsheet, adminOnly: false },
  { to: '/gestor/imoveis-problematicos', label: 'Imóveis Problemáticos',      icon: MapPin,         adminOnly: false },
  { to: '/gestor/sla',                   label: 'Configuração de SLA',        icon: Timer,          adminOnly: false },
  { to: '/gestor/sla-feriados',          label: 'Feriados do SLA',            icon: CalendarRange,  adminOnly: false },
  { to: '/gestor/plano-acao',            label: 'Planos de Ação',             icon: ClipboardCheck, adminOnly: false },
  { to: '/gestor/score-config',          label: 'Config. Score',              icon: Settings2,      adminOnly: false },
];

const grupoPlataforma = [
  { to: '/admin/clientes',          label: 'Clientes (Prefeituras)',    icon: Building2,  adminOnly: true },
  { to: '/admin/usuarios',          label: 'Usuários',                  icon: Users,      adminOnly: true },
  { to: '/admin/agrupamentos',      label: 'Agrupamentos Regionais',    icon: Globe2,     adminOnly: true },
  { to: '/admin/painel-municipios', label: 'Painel de Municípios',      icon: Globe2,     adminOnly: true },
  { to: '/admin/quotas',            label: 'Quotas',                    icon: Gauge,      adminOnly: true },
  { to: '/admin/drones',            label: 'Drones',                    icon: IconDrone,  adminOnly: true },
  { to: '/admin/voos',              label: 'Voos',                      icon: Plane,      adminOnly: true },
  { to: '/admin/yolo-qualidade',    label: 'Qualidade do Drone (YOLO)', icon: Eye,        adminOnly: true },
  { to: '/admin/pipeline-status',   label: 'Pipeline Drone',            icon: Activity,   adminOnly: true },
  { to: '/admin/saude-sistema',     label: 'Saúde do Sistema',          icon: HeartPulse, adminOnly: true },
  { to: '/admin/job-queue',         label: 'Fila de Jobs',              icon: ListTodo,   adminOnly: true },
];

/**
 * Rotas permitidas para operador (portal próprio).
 * Sem dashboard geral e sem SLA operacional. Demais redirecionam para o mapa do operador.
 */
type NavSearchEntry = { to: string; label: string };

function dedupeNavByPath(items: NavSearchEntry[]): NavSearchEntry[] {
  const seen = new Map<string, string>();
  for (const it of items) {
    if (!seen.has(it.to)) seen.set(it.to, it.label);
  }
  return Array.from(seen.entries()).map(([to, label]) => ({ to, label }));
}

/** Lista plana de rotas do menu para busca no sidebar (por papel). */
function buildSidebarSearchIndex(params: {
  papel: string | null | undefined;
  isAdmin: boolean;
  isAgente: boolean;
}): NavSearchEntry[] {
  const { papel, isAdmin, isAgente } = params;
  const out: NavSearchEntry[] = [];
  const push = (arr: { to: string; label: string; adminOnly?: boolean }[]) => {
    for (const it of arr) {
      if (!it.adminOnly || isAdmin) out.push({ to: it.to, label: it.label });
    }
  };

  if (papel === 'admin') {
    push(adminMonitorNavItems.map(({ to, label }) => ({ to, label })));
    push(grupoPlataforma);
    return dedupeNavByPath(out);
  }
  if (papel === 'analista_regional') {
    push(analistaRegionalNavItems.map(({ to, label }) => ({ to, label })));
    return dedupeNavByPath(out);
  }
  if (papel === 'notificador') {
    push(notificadorNavItems.map(({ to, label }) => ({ to, label })));
    return dedupeNavByPath(out);
  }
  if (isAgente) {
    push(operadorNavItems.map(({ to, label }) => ({ to, label })));
    return dedupeNavByPath(out);
  }

  push(baseNavItems.map(({ to, label }) => ({ to, label })));
  push(grupoPlnejamento);
  push(grupoSaudeVigilancia);
  push(grupoInteligencia);
  push(grupoRiscoClima);
  push(grupoConfiguracoes);
  if (isAdmin) push(grupoPlataforma);
  return dedupeNavByPath(out);
}

const OPERADOR_ALLOWED_PATHS = [
  '/',
  '/agente/hoje',
  '/agente/vistoria',
  '/agente/imoveis',
  '/agente/levantamentos',
  '/agente/levantamentos/novo-item',
  '/agente/focos',
  '/agente/reinspecao',
  '/agente/mapa',
  '/agente/rota',
  // aliases legados — redirecionam mas precisam estar na lista para não bloquear antes do redirect
  '/operador/imoveis',
  '/operador/levantamentos',
  '/operador/mapa',
  '/operador/levantamentos/novo-item',
  '/operador/rota',
];

// PAPEL_LABEL importado de @/lib/labels — fonte única de verdade

interface SidebarGroupProps {
  label: string;
  icon: React.ElementType;
  items: { to: string; label: string; icon: React.ElementType; adminOnly?: boolean }[];
  isAdmin: boolean;
  location: ReturnType<typeof useLocation>;
  onClose: () => void;
}

const SidebarGroup = ({ label, icon: GroupIcon, items, isAdmin, location, onClose }: SidebarGroupProps) => {
  const visibleItems = items.filter(item => isAdmin || !item.adminOnly);
  if (visibleItems.length === 0) return null;
  const isGroupActive = visibleItems.some(item => location.pathname.startsWith(item.to));
  return (
    <Collapsible defaultOpen={isGroupActive}>
      <CollapsibleTrigger className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isGroupActive ? "bg-white/15 text-white ring-1 ring-white/20" : "text-white/70 hover:bg-white/10 hover:text-white"
      )}>
        <GroupIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 ease-in-out [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 ml-4 space-y-1 border-l border-white/20 pl-3 overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        {visibleItems.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
          return (
            <Link key={item.to} to={item.to} onClick={onClose}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all duration-200",
                active ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20" : "text-white/70 hover:bg-white/10 hover:text-white"
              )}>
              {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-white rounded-r-full" />}
              <item.icon className="h-3 w-3 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};

const AppLayout = () => {
  const { usuario, papel, isAdmin, isAdminOrSupervisor, isAgente, signOut } = useAuth();
  const { ativo: modoAnalitico, toggle: toggleModoAnalitico } = useModoAnalitico();
  const { clienteId, setClienteId, clientes } = useClienteAtivo();
  const queryClient = useQueryClient();
  const { pendingCount: offlinePending, isSyncing: offlineSyncing } = useOfflineQueue();
  const { data: alertasRetornoNav = [] } = useAlertasRetorno(
    isAgente ? clienteId : null,
    isAgente ? usuario?.id ?? null : null,
  );
  const alertasVencidosCount = alertasRetornoNav.filter(
    (a) => new Date(a.retorno_em) <= new Date(),
  ).length;

  const navigate = useNavigate();
  const location = useLocation();

  // Prefetch operator data on login so items are cached before first navigation.
  // Runs once when clienteId + usuarioId are first available for an operador.
  useEffect(() => {
    if (!isAgente || !clienteId || !usuario?.id) return;
    queryClient.prefetchQuery({
      queryKey: ['itens_operador', clienteId, usuario.id],
      queryFn: () => api.itens.listByOperador(clienteId, usuario.id),
    });
  }, [isAgente, clienteId, usuario?.id, queryClient]);

  // Operador: só acessa rotas do portal operador
  const operadorPathAllowed = useMemo(() => {
    if (!isAgente) return true;
    const path = location.pathname;
    return OPERADOR_ALLOWED_PATHS.some(allowed => path === allowed || (allowed !== '/' && path.startsWith(allowed)));
  }, [isAgente, location.pathname]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [onboardingForce, setOnboardingForce] = useState(false);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [draining, setDraining] = useState(false);
  const { theme, setTheme } = useTheme();

  // Evita backdrop mobile (z baixo) ficar acima do drawer ao redimensionar para desktop
  // e mantém estado coerente com breakpoints do layout (lg = 1024px).
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  function handleAbrirComoUsar() {
    if (usuario?.id) resetarOnboarding(usuario.id);
    setOnboardingForce(true);
    setSidebarOpen(false);
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const isAdminSection = location.pathname.startsWith('/admin');

  // Mobile: notificador / operador têm menus próprios; demais usam baseNavItems + Cadastros
  const mobileNavItems = useMemo(() => {
    if (papel === 'admin') return [
      { to: '/admin/dashboard',       label: 'Dashboard', icon: LayoutDashboard },
      { to: '/admin/clientes',      label: 'Clientes',  icon: Building2 },
      { to: '/admin/saude-sistema', label: 'Sistema',   icon: HeartPulse },
      { to: '/admin/job-queue',     label: 'Jobs',      icon: ListTodo },
    ];
    if (papel === 'analista_regional') return [
      { to: '/regional/dashboard',         label: 'Regional',  icon: BarChart2 },
      { to: '/gestor/dashboard-analitico', label: 'Analítico', icon: LayoutDashboard },
    ];
    if (papel === 'notificador') return [...notificadorNavItems];
    if (isAgente) return [
      { to: '/agente/hoje',          label: 'Meu Dia',  icon: Home },
      { to: '/agente/imoveis',       label: 'Imóveis',  icon: Building2 },
      { to: '/agente/mapa',          label: 'Mapa',     icon: MapIcon },
      { to: '/agente/levantamentos', label: 'Vistorias', icon: ClipboardList },
    ];
    return [
      { to: '/gestor/central', label: 'Central',   icon: Radio },
      { to: '/gestor/focos',   label: 'Focos',     icon: Target },
      { to: '/gestor/mapa',    label: 'Mapa',      icon: MapIcon },
    ];
  }, [papel, isAgente]);

  const bottomNavItems = mobileNavItems.slice(0, 4);
  const moreNavItems = mobileNavItems.slice(4);

  const navSearchIndex = useMemo(
    () => buildSidebarSearchIndex({ papel, isAdmin, isAgente }),
    [papel, isAdmin, isAgente],
  );
  const navSearchResults = useMemo(() => {
    const q = navSearch.trim().toLowerCase();
    if (!q) return [];
    return navSearchIndex.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.to.toLowerCase().includes(q),
    );
  }, [navSearch, navSearchIndex]);

  const doSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login');
    }
  };

  const handleSignOut = () => {
    if (offlinePending > 0) {
      setLogoutDialog(true);
      return;
    }
    doSignOut();
  };

  const handleSincronizarESair = async () => {
    setDraining(true);
    try {
      await drainQueue();
    } finally {
      setDraining(false);
      setLogoutDialog(false);
      doSignOut();
    }
  };

  if (isAgente && !operadorPathAllowed) {
    return <Navigate to="/agente/mapa" replace />;
  }

  return (
    <div className="isolate flex min-h-screen overflow-x-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — max-lg:z-[100] garante drawer acima do backdrop (z-30) e de camadas do mapa (Leaflet) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 max-lg:z-[100] flex w-64 flex-col gradient-login-panel border-r border-white/10 text-white/80 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 shadow-2xl",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-20 items-center justify-between px-6 mb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-lg shrink-0">
              <LogoIcon size={24} className="shrink-0" />
            </div>
            <div className="flex flex-col">
              <Logo className="text-xl sm:text-2xl text-white" showIcon={false} />
              <span className="text-[10px] font-bold text-white/90 tracking-[0.2em] uppercase opacity-80">Map&reg;</span>
            </div>
          </div>
        </div>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 z-[1] h-3.5 w-3.5 -translate-y-1/2 text-white/45"
              aria-hidden
            />
            <Input
              type="search"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              placeholder="Buscar no menu…"
              className="h-9 border-white/20 bg-white/10 pl-8 text-xs text-white placeholder:text-white/40 focus-visible:ring-white/30"
              aria-label="Buscar item do menu"
              autoComplete="off"
            />
            {navSearch.trim() ? (
              <ul
                className="absolute left-0 right-0 top-full z-[120] mt-1 max-h-52 overflow-y-auto rounded-lg border border-white/20 bg-[#0c4533] py-1 shadow-xl"
                role="listbox"
                aria-label="Resultados da busca"
              >
                {navSearchResults.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-white/50">Nenhum item encontrado</li>
                ) : (
                  navSearchResults.slice(0, 18).map((it) => (
                    <li key={it.to} role="option">
                      <Link
                        to={it.to}
                        onClick={() => {
                          setNavSearch('');
                          setSidebarOpen(false);
                        }}
                        className="block px-3 py-2 text-xs text-white/90 hover:bg-white/10"
                      >
                        {it.label}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        </div>

        {/* Admin client selector */}
        {isAdmin && clientes.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/60 font-semibold mb-1.5 px-1">
              <Building2 className="w-3.5 h-3.5" /> Cliente ativo
            </label>
            <Select value={clienteId || ''} onValueChange={setClienteId}>
              <SelectTrigger className="h-9 rounded-sm text-xs bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent className="bg-[#10563f] border-white/20 text-white shadow-xl">
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs hover:bg-white/10 focus:bg-white/20 focus:text-white cursor-pointer data-[state=checked]:bg-white/20">
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Nav — operador: portal próprio; demais: Início & Monitoramento + Contextos (Cadastros, Risco, Operação, etc.) */}
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto min-h-0 [&_a]:rounded-sm [&_button]:rounded-sm">
          {papel === 'admin' ? (
            /* Admin de plataforma: monitoramento + gestão da plataforma SaaS */
            <>
              <div className="mb-2">
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">Monitoramento</p>
                {adminMonitorNavItems.map((item) => {
                  const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                  return (
                    <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        active ? "bg-white/15 text-white ring-1 ring-white/20 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}>
                      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />}
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <div className="mb-1">
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">Plataforma SaaS</p>
                <SidebarGroup label="Clientes & Plataforma" icon={Building2} items={grupoPlataforma} isAdmin={isAdmin} location={location} onClose={() => setSidebarOpen(false)} />
              </div>
            </>
          ) : papel === 'notificador' ? (
            /* Notificador: meus casos + novo caso */
            notificadorNavItems.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-white/15 text-white ring-1 ring-white/20 shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />}
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })
          ) : papel === 'analista_regional' ? (
            /* Analista Regional: somente dashboard regional */
            analistaRegionalNavItems.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-white/15 text-white ring-1 ring-white/20 shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />}
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })
          ) : isAgente ? (
            /* 4. Operador: menu próprio de operações (sem acesso às opções acima) */
            operadorNavItems.map((item) => {
              const active = isActive(item.to);
              const badge = item.to === '/agente/hoje' && alertasVencidosCount > 0 ? alertasVencidosCount : 0;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-white/15 text-white ring-1 ring-white/20 shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />}
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 && (
                    <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </Link>
              );
            })
          ) : (
            <>
              {/* Seção: Operação */}
              <div className="mb-2">
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">Operação</p>
                {baseNavItems.map((item) => {
                  const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                  return (
                    <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        active ? "bg-white/15 text-white ring-1 ring-white/20 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}>
                      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />}
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              {/* Seção: Planejamento */}
              <div className="mb-1">
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">Planejamento</p>
                <SidebarGroup label="Planejamento & Campo" icon={CalendarRange} items={grupoPlnejamento} isAdmin={isAdmin} location={location} onClose={() => setSidebarOpen(false)} />
              </div>

              {/* Seção: Saúde & Vigilância */}
              <div className="mb-1">
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">Saúde & Vigilância</p>
                <SidebarGroup label="Saúde & Casos" icon={Stethoscope} items={grupoSaudeVigilancia} isAdmin={isAdmin} location={location} onClose={() => setSidebarOpen(false)} />
                <SidebarGroup label="Risco & Clima" icon={CloudRain} items={grupoRiscoClima} isAdmin={isAdmin} location={location} onClose={() => setSidebarOpen(false)} />
              </div>

              {/* Seção: Análise */}
              <div className="mb-1">
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">Análise</p>
                <SidebarGroup label="Inteligência & Análise" icon={BarChart2} items={grupoInteligencia} isAdmin={isAdmin} location={location} onClose={() => setSidebarOpen(false)} />
              </div>

              {/* Seção: Configurações */}
              <div className="mb-1">
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">Configurações</p>
                <SidebarGroup label="Configurações Municipais" icon={Settings2} items={grupoConfiguracoes} isAdmin={isAdmin} location={location} onClose={() => setSidebarOpen(false)} />
              </div>

              {/* Plataforma SaaS aparece somente no menu dedicado do admin (papel === 'admin') */}
            </>
          )}
        </nav>

        {/* Footer — conta + atalhos (alinhamento com ícone fixo como o menu principal) */}
        <div className="shrink-0 mt-auto border-t border-white/[0.12] bg-gradient-to-b from-black/5 to-black/20 backdrop-blur-[2px]">
          <div className="space-y-2 p-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-2 py-2 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-white/25 to-white/10 text-xs font-black text-white shadow-sm ring-1 ring-white/15">
                {usuario?.nome?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold leading-tight text-white">
                  {usuario?.nome || 'Usuário'}
                </p>
                {papel && (
                  <p
                    className="mt-0.5 truncate text-[10px] font-medium leading-tight text-emerald-50/85"
                    title={`Papel: ${PAPEL_LABEL[papel] ?? papel}`}
                  >
                    {PAPEL_LABEL[papel] ?? papel}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={handleAbrirComoUsar}
                className="group flex h-8 w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-semibold text-white/85 transition-all hover:border-white/20 hover:bg-white/12 hover:text-white"
                title="Ver tour de boas-vindas novamente"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0 opacity-90 group-hover:opacity-100" aria-hidden />
                <span className="min-w-0 truncate text-left">Como usar</span>
              </button>

              {(isAdminOrSupervisor || papel === 'analista_regional') && (
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={toggleModoAnalitico}
                    className={cn(
                      'group flex h-8 w-full items-center gap-2 rounded-lg border px-2.5 text-[11px] font-semibold transition-all',
                      modoAnalitico
                        ? 'border-blue-400/35 bg-blue-500/18 text-blue-100 hover:bg-blue-500/28'
                        : 'border-white/10 bg-white/[0.04] text-white/85 hover:border-white/20 hover:bg-white/12 hover:text-white',
                    )}
                    title={
                      modoAnalitico
                        ? 'Ocultar dimensões de risco nas telas de detalhe'
                        : 'Exibir resultado operacional e dimensões de risco em cada vistoria'
                    }
                  >
                    {modoAnalitico ? (
                      <EyeOff className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                    ) : (
                      <Eye className="h-3.5 w-3.5 shrink-0 opacity-90 group-hover:opacity-100" aria-hidden />
                    )}
                    <span className="min-w-0 truncate text-left">
                      {modoAnalitico ? 'Ocultar análise' : 'Ver análise'}
                    </span>
                  </button>
                  {modoAnalitico && (
                    <p className="px-0.5 text-center text-[9px] leading-tight text-blue-200/75">
                      Dimensões visíveis nas vistorias
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="group flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-transparent bg-transparent px-2 text-[10px] font-medium text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
                  title={theme === 'dark' ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-3 w-3 shrink-0 text-white/40 group-hover:text-white/65" aria-hidden />
                  ) : (
                    <Moon className="h-3 w-3 shrink-0 text-white/40 group-hover:text-white/65" aria-hidden />
                  )}
                  <span className="min-w-0 truncate text-left">{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-400/25 bg-red-500/12 text-red-300 transition-all hover:border-red-400/50 hover:bg-red-500 hover:text-white"
                  title="Sair"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col pb-16 lg:pb-0 overflow-x-hidden min-w-0">
        <OfflineBanner pendingCount={offlinePending} isSyncing={offlineSyncing} />
        <QuotaBanner />
        {/* Mobile menu button */}
        <div className="flex h-10 items-center justify-between px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          {!isAgente && <SlaAlertBell clienteId={clienteId ?? null} />}
        </div>

        <main
          className={cn(
            'flex-1 premium-mesh-bg flex flex-col min-h-0 overflow-x-hidden',
            location.pathname === '/mapa' || location.pathname === '/agente/mapa'
              ? 'overflow-y-hidden'
              : 'overflow-y-auto'
          )}
        >
          {location.pathname === '/mapa' || location.pathname === '/agente/mapa' ? (
            <div className="flex-1 min-h-0 w-full flex flex-col">
              <Outlet />
            </div>
          ) : location.pathname === '/agente/levantamentos' || location.pathname === '/agente/levantamentos/novo-item' ? (
            <div className="px-2 py-4 w-full lg:px-6 lg:py-10 max-w-[1600px] mx-auto">
              <Outlet />
            </div>
          ) : (
            <div className="p-4 lg:p-10 max-w-[1600px] mx-auto w-full min-w-0">
              <Outlet />
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex lg:hidden border-t bg-card shadow-lg">
        {bottomNavItems.map((item) => {
          const active = isActive(item.to);
          const badge = item.to === '/agente/hoje' && alertasVencidosCount > 0 ? alertasVencidosCount : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <item.icon className={cn("h-5 w-5", active && "text-primary")} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}
        {(moreNavItems.length > 0 || isAgente || papel === 'notificador') && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                isAdminSection ? "text-primary" : "text-muted-foreground"
              )}>
                {isAgente || papel === 'notificador' ? (
                  <User className="h-5 w-5" />
                ) : (
                  <MoreHorizontal className={cn("h-5 w-5", isAdminSection && "text-primary")} />
                )}
                <span>{isAgente || papel === 'notificador' ? 'Conta' : 'Mais'}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2 min-w-[180px]">
              {isAdminOrSupervisor && (
                <>
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Configurações
                  </div>
                  {grupoConfiguracoes.filter(item => isAdmin || !item.adminOnly).map((sub) => (
                    <DropdownMenuItem key={sub.to} asChild>
                      <Link to={sub.to} className={cn(
                        "flex items-center gap-2",
                        location.pathname === sub.to && "text-primary font-semibold"
                      )}>
                        <sub.icon className="h-4 w-4" />
                        {sub.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  {isAdmin && grupoPlataforma.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Plataforma
                      </div>
                      {grupoPlataforma.map((sub) => (
                        <DropdownMenuItem key={sub.to} asChild>
                          <Link to={sub.to} className={cn(
                            "flex items-center gap-2",
                            location.pathname === sub.to && "text-primary font-semibold"
                          )}>
                            <sub.icon className="h-4 w-4" />
                            {sub.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>

      {/* Onboarding — primeiro login por versão + re-abertura via "Como usar" */}
      {usuario?.id && (
        <OnboardingModal
          userId={usuario.id}
          usuarioDbId={usuario.id}
          papel={papel}
          forceOpen={onboardingForce}
          onClose={() => setOnboardingForce(false)}
        />
      )}

      {/* Modal de logout com fila pendente */}
      <Dialog open={logoutDialog} onOpenChange={(v) => { if (!draining) setLogoutDialog(v); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Vistorias aguardando envio</DialogTitle>
            <DialogDescription>
              Você tem <strong>{offlinePending}</strong> vistoria{offlinePending !== 1 ? 's' : ''} na fila aguardando sincronização.
              Sair agora pode causar perda de dados de campo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full"
              onClick={handleSincronizarESair}
              disabled={draining}
            >
              {draining ? 'Sincronizando…' : 'Sincronizar agora e sair'}
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => { setLogoutDialog(false); doSignOut(); }}
              disabled={draining}
            >
              Sair sem sincronizar
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLogoutDialog(false)}
              disabled={draining}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppLayout;
