import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, MapPin, Bug, Droplets, Download, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { getHomeByPapel } from "@/lib/roleRedirect";

const Login = React.forwardRef<HTMLDivElement>((_props, _ref) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const { signIn, session, papel, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [isStandalone] = useState(() => window.matchMedia("(display-mode: standalone)").matches);

  // Redirect when session + papel are both resolved
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    if (!session || authLoading) return;
    setRedirecting(true);
    navigate(getHomeByPapel(papel), { replace: true });
  }, [session, papel, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      const err = error as Error & { status?: number };
      console.error('Login error:', err.message, err.status);
      if (err.message?.includes('Email not confirmed')) {
        setError("Email ainda não confirmado. Verifique sua caixa de entrada.");
      } else if (err.message?.includes('Invalid login credentials')) {
        setError("Email ou senha inválidos.");
      } else {
        setError(err.message || "Erro ao fazer login.");
      }
    }
    // Don't navigate here — the useEffect above handles it when session updates
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Digite seu email para redefinir a senha");
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Email de redefinição enviado! Verifique sua caixa de entrada.");
      setForgotMode(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar email");
    } finally {
      setForgotLoading(false);
    }
  };

  const features = [
    { icon: Bug, label: "Focos de Dengue" },
    { icon: Droplets, label: "Piscinas Sujas" },
    { icon: MapPin, label: "Pontos Críticos" },
  ];

  if (redirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen min-h-[100dvh] bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Entrando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col lg:flex-row">
      {/* Painel esquerdo - Branding (desktop) / Topo compacto (tablet) */}
      <div className="gradient-login-panel relative overflow-hidden flex-shrink-0 lg:flex lg:flex-col lg:min-h-screen lg:w-[52%] xl:w-[55%]">
        {/* Decoração de fundo */}
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <div className="absolute top-16 left-16 w-64 h-64 rounded-full border-2 border-white/30" />
          <div className="absolute bottom-24 right-12 w-80 h-80 rounded-full border border-white/20" />
          <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full border border-white/15" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.15),transparent)] pointer-events-none" />

        <div className="relative z-10 flex flex-col p-6 sm:p-8 md:p-10 lg:p-12 text-primary-foreground min-h-[200px] md:min-h-[240px] lg:min-h-0 lg:flex-1 lg:justify-between">
          {/* Logo + nome - sempre visível */}
          <div className="flex items-center gap-2">
            <Logo className="text-xl sm:text-2xl text-white" />
            <span className="text-xl sm:text-2xl font-bold tracking-tight">Map</span>
          </div>

          {/* Conteúdo central - desktop */}
          <div className="hidden lg:flex flex-col flex-1 justify-center items-center text-center space-y-6 max-w-lg mt-8 mx-auto">
            <h1 className="text-4xl xl:text-7xl font-extrabold leading-tight text-left">Inspeção</h1>
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight">Inteligente por Drone</h1>
            <p className="text-lg xl:text-xl text-white/75 leading-relaxed">
              Identifique focos de dengue, entulhos, piscinas abandonadas e irregularidades urbanas com precisão e
              agilidade.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-2">
              {features.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10"
                >
                  <Icon className="w-7 h-7 text-white/90" />
                  <span className="text-xs text-center text-white/80 font-medium leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tablet: subtítulo curto */}
          <p className="mt-4 lg:hidden text-sm sm:text-base text-white/80 max-w-md">Inspeção inteligente por drone</p>

          {/* Rodapé - só desktop */}
          <p className="hidden lg:block text-sm text-white/40 mt-auto pt-8">
            © 2026 Sentinella Map. Plataforma para prefeituras e empresas.
          </p>
        </div>
      </div>

      {/* Painel direito - Formulário */}
      <div className="flex-1 flex items-center justify-center login-form-bg px-4 py-8 sm:px-6 sm:py-10 md:px-8 md:py-12 lg:px-12 lg:py-16">
        <div className="w-full max-w-[360px] sm:max-w-[400px] md:max-w-[420px] space-y-6 sm:space-y-8 animate-fade-in">
          {/* Logo mobile/tablet - só quando não tem painel grande */}
          <div className="lg:hidden text-center flex flex-col items-center">
            <div className="flex items-center justify-center gap-2">
              <Logo className="text-2xl sm:text-3xl" />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Map</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1 sm:mt-2">Inspeção Urbana Inteligente</p>
          </div>

          {/* Título desktop */}
          <div className="hidden lg:block">
            <h2 className="text-2xl xl:text-3xl font-bold tracking-tight text-foreground">Bem-vindo de volta</h2>
            <p className="text-muted-foreground mt-1.5 sm:text-lg">Entre com suas credenciais para continuar</p>
          </div>

          <Card className="border-2 border-cardBorder shadow-xl shadow-primary/5 dark:shadow-none overflow-hidden rounded-2xl">
            <CardContent className="p-6 sm:p-8 pt-6 sm:pt-8">
              {forgotMode ? (
                <form onSubmit={handleForgotPassword} className="space-y-5 sm:space-y-6">
                  <button
                    type="button"
                    onClick={() => setForgotMode(false)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao login
                  </button>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Esqueceu sua senha?</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Digite seu email e enviaremos um link para redefinir sua senha.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email" className="text-sm font-medium text-foreground">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="h-11 sm:h-12 text-base sm:text-sm rounded-xl border-input/80 focus-visible:ring-2 focus-visible:ring-primary/30"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 sm:h-12 font-semibold text-base rounded-xl shadow-lg shadow-primary/25"
                    disabled={forgotLoading}
                  >
                    {forgotLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Enviar link de redefinição
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="h-11 sm:h-12 text-base sm:text-sm rounded-xl border-input/80 focus-visible:ring-2 focus-visible:ring-primary/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium text-foreground">Senha</Label>
                      <button
                        type="button"
                        onClick={() => setForgotMode(true)}
                        className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="h-11 sm:h-12 pr-12 rounded-xl border-input/80 focus-visible:ring-2 focus-visible:ring-primary/30"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors touch-manipulation"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/25">
                      <p className="text-sm text-destructive font-medium">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 sm:h-12 font-semibold text-base rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Entrar
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs sm:text-sm text-muted-foreground">Acesso restrito a usuários autorizados</p>

          {/* PWA install banner */}
          {!isStandalone && !dismissedBanner && (
            <div className="relative flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 animate-fade-in">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Instale o app</p>
                <p className="text-[11px] text-muted-foreground">Acesso rápido direto da tela inicial</p>
              </div>
              <Link to="/install">
                <Button size="sm" variant="default" className="h-7 text-xs rounded-lg px-3 shrink-0">
                  Instalar
                </Button>
              </Link>
              <button
                onClick={() => setDismissedBanner(true)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
Login.displayName = 'Login';

export default Login;
