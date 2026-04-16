import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getHomeByPapel } from '@/lib/roleRedirect';
import { Logo } from '@/components/Logo';
import { LogoIcon } from '@/components/LogoIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Zap,
  MapPin,
  Clock,
  CloudRain,
  Users,
  BarChart2,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Megaphone,
  QrCode,
  Shield,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: Zap,
    title: 'Voos com drone e IA',
    description:
      'Análise automática com YOLO identifica focos com precisão de campo, sem depender de inspeção manual.',
  },
  {
    icon: MapPin,
    title: 'Mapeamento georreferenciado',
    description:
      'Cada evidência vinculada à região, bairro e coordenada exata para rastreabilidade total.',
  },
  {
    icon: Clock,
    title: 'SLA e rastreabilidade',
    description:
      'Prazos de atendimento configuráveis por região e prioridade, com histórico completo de ações.',
  },
  {
    icon: CloudRain,
    title: 'Alertas climáticos',
    description:
      'Integração pluviométrica bloqueia voos em condições adversas e recomenda reagendamento automático.',
  },
  {
    icon: Users,
    title: 'Agentes em campo',
    description:
      'App PWA com suporte offline para registro de vistorias e planos de ação sem dependência de internet.',
  },
  {
    icon: BarChart2,
    title: 'Relatórios e gestão',
    description:
      'Dashboards com indicadores operacionais em tempo real para gestores e supervisores municipais.',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Planejamento',
    description:
      'A equipe cria o roteiro de inspeção por região ou bairro — por drone ou vistoria manual — com base no cadastro municipal.',
  },
  {
    number: '02',
    title: 'Levantamento',
    description:
      'O drone captura imagens em voo. A IA identifica focos automaticamente. O operador valida e complementa em campo.',
  },
  {
    number: '03',
    title: 'Ação corretiva',
    description:
      'Cada problema identificado é rastreado com SLA, plano de ação vinculado e histórico de atendimento completo.',
  },
];

/** Pilares reais do produto (sem métricas de marketing não auditáveis). */
const STATS = [
  { value: 'LGPD', label: 'Casos: endereço e bairro, sem identificar o paciente' },
  { value: 'SLA', label: 'Prazos configuráveis por região e prioridade' },
  { value: 'Offline', label: 'Fila local para vistorias quando não há rede' },
];

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function HeroSection() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="gradient-login-panel relative overflow-hidden min-h-[92dvh] flex flex-col justify-center -mt-16 pt-20 sm:pt-24">
      {/* Decorative circles */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-20 left-[10%] w-72 h-72 rounded-full border border-white/25" />
        <div className="absolute top-40 left-[14%] w-48 h-48 rounded-full border border-white/15" />
        <div className="absolute bottom-20 right-[8%] w-96 h-96 rounded-full border border-white/20" />
        <div className="absolute bottom-40 right-[12%] w-56 h-56 rounded-full border border-white/12" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/8" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_60%_40%,rgba(255,255,255,0.06),transparent)] pointer-events-none" />

      {/* Decorative LogoIcon watermark */}
      <div className="absolute right-[5%] top-1/2 -translate-y-1/2 opacity-[0.07] pointer-events-none hidden lg:block">
        <LogoIcon size={420} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            <span className="text-xs font-semibold text-white/90 uppercase tracking-widest">
              Plataforma para prefeituras
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white leading-[1.08] tracking-tight mb-6">
            Monitore, identifique
            <br />
            <span className="text-emerald-300">e elimine</span>
            <br />
            focos de dengue
          </h1>

          <p className="text-base sm:text-lg lg:text-xl text-white/70 leading-relaxed max-w-xl mb-10">
            Combine voos com drone, análise por inteligência artificial e vistorias de campo em
            uma única plataforma operacional para sua prefeitura.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button
              size="lg"
              onClick={() => scrollTo('contato')}
              className="h-12 px-6 text-base font-semibold rounded-xl bg-white text-primary hover:bg-white/90 shadow-xl shadow-black/20 transition-all"
            >
              Solicitar demonstração
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Link to="/login">
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base font-semibold rounded-xl border-white/30 text-white bg-white/10 hover:bg-white/20 hover:border-white/50 backdrop-blur-sm transition-all w-full sm:w-auto"
              >
                Acessar o sistema
                <ChevronRight className="ml-1.5 w-4 h-4 opacity-70" />
              </Button>
            </Link>
          </div>

          {/* Citizen CTA */}
          <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-amber-300" />
            </div>
            <span className="text-sm text-white/75">
              É cidadão?{' '}
              <Link to="/denunciar" className="text-amber-300 font-semibold hover:text-amber-200 underline underline-offset-2 transition-colors">
                Denuncie um foco de dengue
              </Link>
            </span>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-10">
            {['Supabase + PostgreSQL', 'YOLO + Drone', 'PWA Offline'].map((item) => (
              <span
                key={item}
                className="flex items-center gap-1.5 text-xs text-white/50 font-medium"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/70" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom wave fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background/20 to-transparent" />
    </section>
  );
}

function StatsBar() {
  return (
    <section className="bg-card border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center text-center px-6 py-2 ${
                i < STATS.length - 1
                  ? 'sm:border-r sm:border-border/60 border-b sm:border-b-0 pb-6 sm:pb-2'
                  : ''
              }`}
            >
              <span className="text-3xl sm:text-4xl font-extrabold text-primary tracking-tight">
                {stat.value}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium max-w-[200px] sm:max-w-none leading-snug">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-20 sm:py-24 lg:py-28 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-14 sm:mb-16">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-3">
            Funcionalidades
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
            Uma plataforma completa
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Do voo do drone ao plano de ação — tudo integrado, rastreável e auditável.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="group rounded-2xl border-border/60 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section
      id="como-funciona"
      className="py-20 sm:py-24 lg:py-28 bg-muted/30 border-y border-border/40 scroll-mt-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-14 sm:mb-16">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-3">
            Como funciona
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
            Do planejamento à ação
          </h2>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {/* Connector line — desktop only */}
          <div className="hidden md:block absolute top-[2.75rem] left-[calc(16.66%+1.5rem)] right-[calc(16.66%+1.5rem)] h-px bg-gradient-to-r from-border via-primary/40 to-border pointer-events-none" />

          {STEPS.map((step, i) => (
            <div key={step.title} className="relative flex flex-col items-center text-center">
              {/* Number bubble */}
              <div className="relative z-10 w-14 h-14 rounded-2xl gradient-login-panel flex items-center justify-center shadow-lg shadow-primary/20 mb-5 shrink-0">
                <span className="text-lg font-extrabold text-white tabular-nums">{step.number}</span>
              </div>

              {/* Mobile connector */}
              {i < STEPS.length - 1 && (
                <div className="md:hidden w-px h-8 bg-border/60 my-1" />
              )}

              <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CanalCidadaoSection() {
  return (
    <section id="canal-cidadao" className="py-20 sm:py-24 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Texto */}
            <div className="px-8 py-10 sm:px-12 sm:py-14 flex flex-col justify-center">
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-4">
                Para os cidadãos
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight leading-tight mb-4">
                Viu água parada?<br />
                <span className="text-amber-600 dark:text-amber-400">Denuncie agora.</span>
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-8 max-w-sm">
                O Canal do Cidadão permite que qualquer pessoa reporte focos de dengue diretamente
                para a equipe municipal — sem criar conta, de forma anônima e gratuita.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/denunciar">
                  <Button
                    size="lg"
                    className="h-12 px-6 text-base font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25 transition-all w-full sm:w-auto"
                  >
                    <Megaphone className="w-4 h-4 mr-2" />
                    Fazer uma denúncia
                  </Button>
                </Link>
                <Link to="/denuncia/consultar">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 text-base font-semibold rounded-xl border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all w-full sm:w-auto"
                  >
                    Consultar protocolo
                  </Button>
                </Link>
              </div>
            </div>

            {/* Cards de features */}
            <div className="px-8 py-10 sm:px-12 sm:py-14 bg-amber-100/50 dark:bg-amber-900/20 flex flex-col justify-center gap-5">
              {[
                {
                  icon: Shield,
                  title: 'Anônimo e seguro',
                  desc: 'Nenhum dado pessoal é solicitado. Apenas localização e descrição do problema.',
                },
                {
                  icon: MapPin,
                  title: 'Geolocalização automática',
                  desc: 'O sistema identifica sua cidade pelo GPS e encaminha para a equipe certa.',
                },
                {
                  icon: QrCode,
                  title: 'Protocolo de acompanhamento',
                  desc: 'Receba um código para consultar o status da sua denúncia a qualquer momento.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section id="contato" className="gradient-login-panel relative overflow-hidden py-20 sm:py-24 lg:py-28 scroll-mt-16">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none opacity-15">
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full border border-white/20" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full border border-white/15" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(255,255,255,0.05),transparent)] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="inline-block text-xs font-bold uppercase tracking-widest text-emerald-300 mb-4">
          Fale conosco
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight mb-5">
          Leve a tecnologia de inspeção inteligente para sua cidade
        </h2>
        <p className="text-white/65 text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto">
          Nossa equipe apresenta a plataforma, entende as necessidades da sua prefeitura e configura
          o sistema para a sua realidade operacional.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="mailto:contato@sentinellamap.com.br?subject=Demonstra%C3%A7%C3%A3o%20Sentinella%20%E2%80%94%20prefeitura"
            className="inline-flex"
          >
            <Button
              size="lg"
              className="h-12 px-8 text-base font-bold rounded-xl bg-white text-primary hover:bg-white/90 shadow-xl shadow-black/20 transition-all w-full sm:w-auto"
            >
              Solicitar demonstração
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </a>
        </div>

        <div className="mt-8">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white/90 transition-colors"
          >
            Já tem acesso? Entrar no sistema
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const LandingPage: React.FC = () => {
  const { session, loading, papel } = useAuth();

  if (loading) return null;
  if (session) return <Navigate to={getHomeByPapel(papel)} replace />;

  return (
    <div className="animate-fade-in">
      <HeroSection />
      <StatsBar />
      <FeaturesSection />
      <HowItWorksSection />
      <CanalCidadaoSection />
      <CtaSection />
    </div>
  );
};

export default LandingPage;
