import React, { Suspense, lazy, forwardRef } from 'react';
import { AdminOrSupervisorGuard } from '@/guards/AdminOrSupervisorGuard';
import { SupervisorOnlyGuard } from '@/guards/SupervisorOnlyGuard';
import { NotificadorGuard } from '@/guards/NotificadorGuard';
import { PlatformAdminGuard } from '@/guards/PlatformAdminGuard';
import { TenantBlockedGuard } from '@/guards/TenantBlockedGuard';
import { AnalistaRegionalGuard } from '@/guards/AnalistaRegionalGuard';
import { DashboardAnaliticoGuard } from '@/guards/DashboardAnaliticoGuard';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryClientDefaults } from "@/lib/queryConfig";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ClienteAtivoProvider } from "@/hooks/useClienteAtivo";
import { ModoAnaliticoProvider } from "@/hooks/useModoAnalitico";
import AppLayout from "@/components/AppLayout";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { Loader2 } from "lucide-react";
import { getHomeByPapel } from "@/lib/roleRedirect";

/** Garante que lazy sempre receba um componente válido (evita "Component is not a function"). */
function safeLazy<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T } | { [k: string]: T }>,
  getDefault?: (m: { [k: string]: T }) => T
) {
  return lazy(async () => {
    const m = await factory();
    const Component = getDefault ? getDefault(m as { [k: string]: T }) : (m as { default: T }).default;
    if (typeof Component !== 'function' && !(Component as Record<string, unknown>)?.$$typeof) {
      console.error('Lazy module did not export a valid component:', m);
      throw new Error(`Component is not a function (module: ${Object.keys(m).join(', ')})`);
    }
    return { default: Component };
  });
}

const Login = safeLazy(() => import("@/pages/Login"));
const Dashboard = safeLazy(() => import("@/pages/Dashboard"));
const AdminGuard = safeLazy(() => import("@/pages/Admin"));
const AdminClientes = safeLazy(() => import("@/pages/admin/AdminClientes"));
const AdminUsuarios = safeLazy(() => import("@/pages/admin/AdminUsuarios"));
const AdminPlanejamentos = safeLazy(() => import("@/pages/admin/AdminPlanejamentos"));
const AdminDrones = safeLazy(() => import("@/pages/admin/AdminDrones"));
const AdminRegioes = safeLazy(() => import("@/pages/admin/AdminRegioes"));
const AdminRiskPolicy = safeLazy(() => import("@/pages/admin/AdminRiskPolicy"));
const AdminVoos = safeLazy(() => import("@/pages/admin/AdminVoos"));
const AdminPluvioRisco = safeLazy(() => import("@/pages/admin/AdminPluvioRisco"));
const AdminPluvioOperacional = safeLazy(() => import("@/pages/admin/AdminPluvioOperacional"));
const AdminSla = safeLazy(() => import("@/pages/admin/AdminSla"));
const AdminOperacoes = safeLazy(() => import("@/pages/admin/AdminOperacoes"));
const AdminHistoricoAtendimento = safeLazy(() => import("@/pages/admin/AdminHistoricoAtendimento"));
const AdminQuotas = safeLazy(() => import("@/pages/admin/AdminQuotas"));
const AdminMapaComparativo = safeLazy(() => import("@/pages/admin/AdminMapaComparativo"));
const AdminHeatmapTemporal = safeLazy(() => import("@/pages/admin/AdminHeatmapTemporal"));
const AdminPainelMunicipios = safeLazy(() => import("@/pages/admin/AdminPainelMunicipios"));
const AdminPlatformDashboard = safeLazy(() => import("@/pages/admin/AdminPlatformDashboard"));
const AdminCasosNotificados = safeLazy(() => import("@/pages/admin/AdminCasosNotificados"));
const AdminImoveis = safeLazy(() => import("@/pages/admin/AdminImoveis"));
const AdminImoveisProblematicos = safeLazy(() => import("@/pages/admin/AdminImoveisProblematicos"));
const AdminImportarImoveis      = safeLazy(() => import("@/pages/admin/AdminImportarImoveis"));
const AdminUnidadesSaude = safeLazy(() => import("@/pages/admin/AdminUnidadesSaude"));
const AdminPlanoAcaoCatalogo = safeLazy(() => import("@/pages/admin/AdminPlanoAcaoCatalogo"));
const AdminSlaFeriados = safeLazy(() => import("@/pages/admin/AdminSlaFeriados"));
const NotificadorHome = safeLazy(() => import("@/pages/notificador/NotificadorHome"));
const NotificadorRegistroCaso = safeLazy(() => import("@/pages/notificador/NotificadorRegistroCaso"));
const Levantamentos = safeLazy(() => import("@/pages/Levantamentos"));
const AgentePage = safeLazy(() => import("@/pages/Agente"));
const AgenteGuard = safeLazy(() => import("@/pages/AgenteGuard"));
const AgenteLevantamentos = safeLazy(() => import("@/pages/agente/AgenteLevantamentos"));
const AgenteNovoItemManual = safeLazy(() => import("@/pages/agente/AgenteNovoItemManual"));
const AgenteMapa = safeLazy(() => import("@/pages/agente/AgenteMapa"));
const AgenteUsuarios = safeLazy(() => import("@/pages/agente/AgenteUsuarios"));
const AgenteListaImoveis = safeLazy(() => import("@/pages/agente/AgenteListaImoveis"));
const AgenteFormularioVistoria = safeLazy(() => import("@/pages/agente/AgenteFormularioVistoria"));
const AgenteRotaDiaria = safeLazy(() => import("@/pages/agente/AgenteRotaDiaria"));
const NotFound = safeLazy(() => import("./pages/NotFound"));
const Install = safeLazy(() => import("./pages/Install"));
const ResetPassword = safeLazy(() => import("./pages/ResetPassword"));
const TrocarSenha = safeLazy(() => import("./pages/TrocarSenha"));
const LandingPage = safeLazy(() => import("./pages/public/LandingPage"));
const DenunciaCidadao = safeLazy(() => import("@/pages/public/DenunciaCidadao"));
const PortalDenuncia = safeLazy(() => import("@/pages/public/PortalDenuncia"));
const AdminCanalCidadao = safeLazy(() => import("@/pages/admin/AdminCanalCidadao"));
const AdminIntegracoes = safeLazy(() => import("@/pages/admin/AdminIntegracoes"));
const AdminLiraa = safeLazy(() => import("@/pages/admin/AdminLiraa"));
const AdminPipelineStatus = safeLazy(() => import("@/pages/admin/AdminPipelineStatus"));
const AdminEficaciaTratamentos = safeLazy(() => import("@/pages/admin/AdminEficaciaTratamentos"));
const AdminProdutividadeAgentes = safeLazy(() => import("@/pages/admin/AdminProdutividadeAgentes"));
const AdminScoreSurto = safeLazy(() => import("@/pages/admin/AdminScoreSurto"));
const AdminYoloQualidade = safeLazy(() => import("@/pages/admin/AdminYoloQualidade"));
const AdminDistribuicaoQuarteirao = safeLazy(() => import("@/pages/admin/AdminDistribuicaoQuarteirao"));
const AdminSupervisorTempoReal = safeLazy(() => import("@/pages/admin/AdminSupervisorTempoReal"));
const AdminSaudeSistema = safeLazy(() => import("@/pages/admin/AdminSaudeSistema"));
const AdminJobQueue = safeLazy(() => import("@/pages/admin/AdminJobQueue"));
const ConsultaProtocolo = safeLazy(() => import("@/pages/public/ConsultaProtocolo"));
const MunicipioPublico = safeLazy(() => import("@/pages/public/MunicipioPublico"));
const GestorFocos = safeLazy(() => import("@/pages/gestor/GestorFocos"));
const GestorFocoDetalhe = safeLazy(() => import("@/pages/gestor/GestorFocoDetalhe"));
const GestorFocoRelatorio = safeLazy(() => import("@/pages/gestor/GestorFocoRelatorio"));
const GestorDashboardTerritorial = safeLazy(() => import("@/pages/gestor/GestorDashboardTerritorial"));
const GestorMapa = safeLazy(() => import("@/pages/gestor/GestorMapa"));
const GestorTriagem = safeLazy(() => import("@/pages/gestor/GestorTriagem"));
const CentralOperacional = safeLazy(() => import("@/pages/gestor/CentralOperacional"));
const AdminScoreConfig = safeLazy(() => import("@/pages/admin/AdminScoreConfig"));
const PainelExecutivo = safeLazy(() => import("@/pages/admin/PainelExecutivo"));
const AdminGestaCiclos = safeLazy(() => import("@/pages/admin/AdminGestaCiclos"));
const AgenteHoje = safeLazy(() => import("@/pages/agente/AgenteHoje"));
const AgenteVistoria = safeLazy(() => import("@/pages/agente/AgenteVistoria"));
const AgenteReinspecao = safeLazy(() => import("@/pages/agente/AgenteReinspecao"));
const AgenteFocoDetalhe = safeLazy(() => import("@/pages/agente/AgenteFocoDetalhe"));
const FichaImovel360 = safeLazy(() => import("@/pages/agente/FichaImovel360"));
const AdminReincidencia = safeLazy(() => import("@/pages/admin/AdminReincidencia"));
const AdminAgrupamentos = safeLazy(() => import("@/pages/admin/AdminAgrupamentos"));
const RegionalDashboard = safeLazy(() => import("@/pages/regional/RegionalDashboard"));
const DashboardAnalitico = safeLazy(() => import("@/pages/gestor/DashboardAnalitico"));
const GestorRelatorios = safeLazy(() => import("@/pages/gestor/GestorRelatorios"));

const PageLoader = forwardRef<HTMLDivElement>((_props, _ref) => (
  <div className="flex bg-background items-center justify-center min-h-[50vh] w-full">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
));
PageLoader.displayName = 'PageLoader';

const queryClient = new QueryClient({ defaultOptions: queryClientDefaults });

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { usuario, loading, mustChangePassword } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/trocar-senha" replace />;
  return <>{children}</>;
};

/** /dashboard — painel operacional do município (cliente selecionado no layout). Admin da plataforma usa /admin/dashboard. */
const QueryRedirect = () => {
  const { papel } = useAuth();
  const home = getHomeByPapel(papel);
  if (home !== '/dashboard') return <Navigate to={home} replace />;
  return <Dashboard />;
};

/** Redireciona /operador/vistoria/:imovelId → /agente/vistoria/:imovelId (fluxo unificado). */
const VistoriaRedirect = () => {
  const params = new URLSearchParams(window.location.search);
  const id = window.location.pathname.split('/').at(-1) ?? '';
  const qs = params.toString();
  return <Navigate to={`/agente/vistoria/${id}${qs ? `?${qs}` : ''}`} replace />;
};

// Autenticado em "/" → home por papel (admin → /admin/dashboard; demais → getHomeByPapel)
const RootRedirect = forwardRef<HTMLDivElement>((_props, _ref) => {
  const { usuario, loading, papel } = useAuth();
  if (loading) return null;
  if (usuario) return <Navigate to={getHomeByPapel(papel)} replace />;
  return <LandingPage />;
});
RootRedirect.displayName = 'RootRedirect';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ClienteAtivoProvider>
            <ModoAnaliticoProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
            {/* ZONA PÚBLICA */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<RootRedirect />} />
            </Route>
            {/* CANAL CIDADÃO — rotas públicas sem autenticação */}
            <Route path="/denunciar" element={<PortalDenuncia />} />
            <Route path="/denuncia/:slug/:bairroId" element={<DenunciaCidadao />} />
            <Route path="/denuncia/consultar" element={<ConsultaProtocolo />} />
            {/* PAINEL PÚBLICO DO MUNICÍPIO */}
            <Route path="/municipio/:slug" element={<MunicipioPublico />} />
            {/* ZONA AUTH */}
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/trocar-senha" element={<TrocarSenha />} />
            <Route path="/install" element={<Install />} />
            {/* ZONA APP */}
            <Route
              element={
                <ProtectedRoute>
                  <TenantBlockedGuard>
                    <AppLayout />
                  </TenantBlockedGuard>
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<QueryRedirect />} />
              <Route path="/levantamentos" element={<AdminOrSupervisorGuard><Levantamentos /></AdminOrSupervisorGuard>} />
              {/* Agente — rotas canônicas /agente/* */}
              <Route path="/agente/imoveis" element={<AgenteGuard><AgenteListaImoveis /></AgenteGuard>} />
              <Route path="/agente/levantamentos" element={<AgenteGuard><AgenteLevantamentos /></AgenteGuard>} />
              <Route path="/agente/levantamentos/novo-item" element={<AgenteGuard><AgenteNovoItemManual /></AgenteGuard>} />
              <Route path="/agente/mapa" element={<AgenteGuard><AgenteMapa /></AgenteGuard>} />
              <Route path="/agente/rota" element={<AgenteGuard><AgenteRotaDiaria /></AgenteGuard>} />
              <Route path="/agente/focos/:focoId" element={<AgenteGuard><AgenteFocoDetalhe /></AgenteGuard>} />
              {/* Aliases legados /operador/* → redirect para /agente/* */}
              <Route path="/operador" element={<Navigate to="/agente/hoje" replace />} />
              <Route path="/operador/inicio" element={<Navigate to="/agente/hoje" replace />} />
              <Route path="/operador/imoveis" element={<Navigate to="/agente/imoveis" replace />} />
              <Route path="/operador/levantamentos" element={<Navigate to="/agente/levantamentos" replace />} />
              <Route path="/operador/levantamentos/novo-item" element={<Navigate to="/agente/levantamentos/novo-item" replace />} />
              <Route path="/operador/mapa" element={<Navigate to="/agente/mapa" replace />} />
              <Route path="/operador/rota" element={<Navigate to="/agente/rota" replace />} />
              <Route path="/operador/vistoria/:imovelId" element={<AgenteGuard><VistoriaRedirect /></AgenteGuard>} />
              <Route path="/operador/usuarios" element={<AdminOrSupervisorGuard><AgenteUsuarios /></AdminOrSupervisorGuard>} />
              <Route path="/mapa" element={<Navigate to="/gestor/mapa" replace />} />
              {/* ── /admin/* ── exclusivo plataforma SaaS (isAdmin) ──────────────────── */}
              <Route path="/admin" element={<AdminGuard />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard"         element={<PlatformAdminGuard><AdminPlatformDashboard /></PlatformAdminGuard>} />
                <Route path="clientes"          element={<PlatformAdminGuard><AdminClientes /></PlatformAdminGuard>} />
                <Route path="usuarios"          element={<PlatformAdminGuard><AdminUsuarios /></PlatformAdminGuard>} />
                <Route path="drones"            element={<PlatformAdminGuard><AdminDrones /></PlatformAdminGuard>} />
                <Route path="voos"              element={<PlatformAdminGuard><AdminVoos /></PlatformAdminGuard>} />
                <Route path="risk-policy"       element={<PlatformAdminGuard><AdminRiskPolicy /></PlatformAdminGuard>} />
                <Route path="quotas"            element={<PlatformAdminGuard><AdminQuotas /></PlatformAdminGuard>} />
                <Route path="painel-municipios" element={<PlatformAdminGuard><AdminPainelMunicipios /></PlatformAdminGuard>} />
                <Route path="canal-cidadao"     element={<PlatformAdminGuard><AdminCanalCidadao /></PlatformAdminGuard>} />
                <Route path="yolo-qualidade"    element={<PlatformAdminGuard><AdminYoloQualidade /></PlatformAdminGuard>} />
                <Route path="saude-sistema"     element={<PlatformAdminGuard><AdminSaudeSistema /></PlatformAdminGuard>} />
                <Route path="job-queue"         element={<PlatformAdminGuard><AdminJobQueue /></PlatformAdminGuard>} />
                <Route path="pipeline-status"   element={<PlatformAdminGuard><AdminPipelineStatus /></PlatformAdminGuard>} />
                <Route path="agrupamentos"      element={<PlatformAdminGuard><AdminAgrupamentos /></PlatformAdminGuard>} />
                {/* backwards-compat: old /admin/* municipal bookmarks → /gestor/* */}
                <Route path="planejamentos"            element={<Navigate to="/gestor/planejamentos" replace />} />
                <Route path="ciclos"                   element={<Navigate to="/gestor/ciclos" replace />} />
                <Route path="regioes"                  element={<Navigate to="/gestor/regioes" replace />} />
                <Route path="distribuicao-quarteirao"  element={<Navigate to="/gestor/distribuicao-quarteirao" replace />} />
                <Route path="operacoes"                element={<Navigate to="/gestor/operacoes" replace />} />
                <Route path="historico-atendimento"    element={<Navigate to="/gestor/historico-atendimento" replace />} />
                <Route path="casos"                    element={<Navigate to="/gestor/casos" replace />} />
                <Route path="liraa"                    element={<Navigate to="/gestor/liraa" replace />} />
                <Route path="score-surto"              element={<Navigate to="/gestor/score-surto" replace />} />
                <Route path="reincidencia"             element={<Navigate to="/gestor/reincidencia" replace />} />
                <Route path="integracoes"              element={<Navigate to="/gestor/integracoes" replace />} />
                <Route path="mapa-comparativo"         element={<Navigate to="/gestor/mapa-comparativo" replace />} />
                <Route path="heatmap-temporal"         element={<Navigate to="/gestor/heatmap-temporal" replace />} />
                <Route path="produtividade-agentes"    element={<Navigate to="/gestor/produtividade-agentes" replace />} />
                <Route path="eficacia-tratamentos"     element={<Navigate to="/gestor/eficacia-tratamentos" replace />} />
                <Route path="executivo"                element={<Navigate to="/gestor/executivo" replace />} />
                <Route path="supervisor-tempo-real"    element={<Navigate to="/gestor/supervisor-tempo-real" replace />} />
                <Route path="pluvio-risco"             element={<Navigate to="/gestor/pluvio-risco" replace />} />
                <Route path="pluvio-operacional"       element={<Navigate to="/gestor/pluvio-operacional" replace />} />
                <Route path="imoveis"                  element={<Navigate to="/gestor/imoveis" replace />} />
                <Route path="imoveis-problematicos"    element={<Navigate to="/gestor/imoveis-problematicos" replace />} />
                <Route path="importar-imoveis"         element={<Navigate to="/gestor/importar-imoveis" replace />} />
                <Route path="unidades-saude"           element={<Navigate to="/gestor/unidades-saude" replace />} />
                <Route path="plano-acao"               element={<Navigate to="/gestor/plano-acao" replace />} />
                <Route path="sla"                      element={<Navigate to="/gestor/sla" replace />} />
                <Route path="sla-feriados"             element={<Navigate to="/gestor/sla-feriados" replace />} />
                <Route path="score-config"             element={<Navigate to="/gestor/score-config" replace />} />
              </Route>
              {/* ── /gestor/* ── operação municipal (supervisor + admin) ──────────────── */}
              {/* Focos de risco — supervisor exclusivo */}
              <Route path="/gestor/central"   element={<SupervisorOnlyGuard><CentralOperacional /></SupervisorOnlyGuard>} />
              <Route path="/gestor/triagem"   element={<SupervisorOnlyGuard><GestorTriagem /></SupervisorOnlyGuard>} />
              <Route path="/gestor/focos"     element={<SupervisorOnlyGuard><GestorFocos /></SupervisorOnlyGuard>} />
              <Route path="/gestor/focos/:id" element={<SupervisorOnlyGuard><GestorFocoDetalhe /></SupervisorOnlyGuard>} />
              <Route path="/gestor/focos/:id/relatorio" element={<SupervisorOnlyGuard><GestorFocoRelatorio /></SupervisorOnlyGuard>} />
              <Route path="/gestor/mapa"      element={<SupervisorOnlyGuard><GestorMapa /></SupervisorOnlyGuard>} />
              {/* Operacional municipal — admin ou supervisor */}
              <Route path="/gestor/planejamentos"           element={<AdminOrSupervisorGuard><AdminPlanejamentos /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/ciclos"                  element={<AdminOrSupervisorGuard><AdminGestaCiclos /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/distribuicao-quarteirao" element={<AdminOrSupervisorGuard><AdminDistribuicaoQuarteirao /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/operacoes"               element={<AdminOrSupervisorGuard><AdminOperacoes /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/historico-atendimento"   element={<AdminOrSupervisorGuard><AdminHistoricoAtendimento /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/casos"                   element={<AdminOrSupervisorGuard><AdminCasosNotificados /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/liraa"                   element={<AdminOrSupervisorGuard><AdminLiraa /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/score-surto"             element={<AdminOrSupervisorGuard><AdminScoreSurto /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/reincidencia"            element={<AdminOrSupervisorGuard><AdminReincidencia /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/integracoes"             element={<AdminOrSupervisorGuard><AdminIntegracoes /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/mapa-comparativo"        element={<AdminOrSupervisorGuard><AdminMapaComparativo /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/heatmap-temporal"        element={<AdminOrSupervisorGuard><AdminHeatmapTemporal /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/produtividade-agentes"   element={<AdminOrSupervisorGuard><AdminProdutividadeAgentes /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/eficacia-tratamentos"    element={<AdminOrSupervisorGuard><AdminEficaciaTratamentos /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/dashboard/territorial"    element={<AdminOrSupervisorGuard><GestorDashboardTerritorial /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/executivo"               element={<AdminOrSupervisorGuard><PainelExecutivo /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/supervisor-tempo-real"   element={<AdminOrSupervisorGuard><AdminSupervisorTempoReal /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/pluvio-risco"            element={<AdminOrSupervisorGuard><AdminPluvioRisco /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/pluvio-operacional"      element={<AdminOrSupervisorGuard><AdminPluvioOperacional /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/regioes"                 element={<AdminOrSupervisorGuard><AdminRegioes /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/unidades-saude"          element={<AdminOrSupervisorGuard><AdminUnidadesSaude /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/imoveis"                 element={<AdminOrSupervisorGuard><AdminImoveis /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/imoveis-problematicos"   element={<AdminOrSupervisorGuard><AdminImoveisProblematicos /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/importar-imoveis"        element={<AdminOrSupervisorGuard><AdminImportarImoveis /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/sla"                     element={<AdminOrSupervisorGuard><AdminSla /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/sla-feriados"            element={<AdminOrSupervisorGuard><AdminSlaFeriados /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/plano-acao"              element={<AdminOrSupervisorGuard><AdminPlanoAcaoCatalogo /></AdminOrSupervisorGuard>} />
              <Route path="/gestor/score-config"            element={<AdminOrSupervisorGuard><AdminScoreConfig /></AdminOrSupervisorGuard>} />
              {/* Agente — vistoria de campo */}
              <Route path="/agente/hoje" element={<AgenteGuard><AgenteHoje /></AgenteGuard>} />
              <Route path="/agente/imoveis/:id" element={<AgenteGuard><FichaImovel360 /></AgenteGuard>} />
              <Route path="/agente/vistoria/:imovelId" element={<AgenteGuard><AgenteVistoria /></AgenteGuard>} />
              <Route path="/agente/vistoria" element={<AgenteGuard><AgenteVistoria /></AgenteGuard>} />
              <Route path="/agente/reinspecao/:reinspecaoId" element={<AgenteGuard><AgenteReinspecao /></AgenteGuard>} />
              {/* Notificador — home + registro + consulta */}
              <Route path="/notificador" element={<NotificadorGuard><NotificadorHome /></NotificadorGuard>} />
              <Route path="/notificador/registrar" element={<NotificadorGuard><NotificadorRegistroCaso /></NotificadorGuard>} />
              <Route path="/notificador/consultar" element={<NotificadorGuard><ConsultaProtocolo /></NotificadorGuard>} />
              {/* Dashboard Analítico Estratégico — supervisor, admin, analista_regional (P8.2) */}
              <Route path="/gestor/dashboard-analitico" element={<DashboardAnaliticoGuard><DashboardAnalitico /></DashboardAnaliticoGuard>} />
              {/* Relatórios Executivos Analíticos — supervisor, admin, analista_regional (P8.3) */}
              <Route path="/gestor/relatorios" element={<DashboardAnaliticoGuard><GestorRelatorios /></DashboardAnaliticoGuard>} />
              {/* Analista Regional — painel comparativo read-only (P5) */}
              <Route path="/regional/dashboard" element={<AnalistaRegionalGuard><RegionalDashboard /></AnalistaRegionalGuard>} />
            </Route>
            {/* Rotas canônicas por perfil — aliases estáveis para bookmarks e links externos */}
            <Route path="/agente/meu-dia"         element={<Navigate to="/agente/hoje"    replace />} />
            <Route path="/notificador/casos"       element={<Navigate to="/notificador"    replace />} />
            <Route path="/supervisor/dashboard"    element={<Navigate to="/gestor/central" replace />} />
            <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ModoAnaliticoProvider>
          </ClienteAtivoProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
