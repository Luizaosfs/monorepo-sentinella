import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crosshair, Download, Share, MoreVertical, Plus, CheckCircle2, Smartphone, Monitor, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios');
    else if (/android/.test(ua)) setPlatform('android');
    else setPlatform('desktop');

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  const iosSteps = [
    { icon: Share, text: 'Toque no botão Compartilhar', detail: 'O ícone de compartilhar fica na barra inferior do Safari' },
    { icon: Plus, text: 'Selecione "Adicionar à Tela de Início"', detail: 'Role as opções até encontrar esta opção' },
    { icon: CheckCircle2, text: 'Confirme tocando em "Adicionar"', detail: 'O app aparecerá como um ícone na sua tela inicial' },
  ];

  const androidSteps = [
    { icon: MoreVertical, text: 'Toque no menu do navegador', detail: 'Os três pontos no canto superior direito do Chrome' },
    { icon: Download, text: 'Selecione "Instalar aplicativo"', detail: 'Ou "Adicionar à tela inicial" dependendo do navegador' },
    { icon: CheckCircle2, text: 'Confirme a instalação', detail: 'O app será instalado e aparecerá na sua tela inicial' },
  ];

  const desktopSteps = [
    { icon: Monitor, text: 'Clique no ícone de instalação', detail: 'Na barra de endereço do Chrome, procure o ícone de download' },
    { icon: Download, text: 'Confirme a instalação', detail: 'Clique em "Instalar" no pop-up que aparecer' },
    { icon: CheckCircle2, text: 'Pronto!', detail: 'O app abrirá em sua própria janela, sem barra de navegação' },
  ];

  const steps = platform === 'ios' ? iosSteps : platform === 'android' ? androidSteps : desktopSteps;

  if (installed) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background">
        <div className="w-16 h-16 rounded-2xl bg-success/15 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">App instalado!</h1>
        <p className="text-muted-foreground text-center max-w-sm mb-8">
          O Sentinella Map já está instalado no seu dispositivo. Acesse diretamente pela tela inicial.
        </p>
        <Link to="/">
          <Button className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao app
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="gradient-login-panel text-primary-foreground p-6 pb-10 sm:p-10 sm:pb-14">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
            <Crosshair className="w-7 h-7" />
          </div>
          <div className="flex items-center gap-2">
            <Logo className="text-2xl text-white" />
            <span className="text-2xl font-bold tracking-tight">Map</span>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-extrabold leading-tight mb-2">
          Instale o app no seu {platform === 'ios' ? 'iPhone' : platform === 'android' ? 'Android' : 'computador'}
        </h1>
        <p className="text-white/75 text-sm sm:text-base max-w-md">
          Acesso rápido, sem precisar abrir o navegador. Funciona offline e recebe atualizações automáticas.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 -mt-6 pb-8 max-w-lg mx-auto w-full">
        {/* Install button (if browser supports it) */}
        {deferredPrompt && (
          <Card className="mb-4 border-primary/30 bg-primary/5 shadow-lg">
            <CardContent className="p-4 flex flex-col items-center gap-3">
              <p className="text-sm font-medium text-foreground text-center">
                Seu navegador suporta instalação direta!
              </p>
              <Button onClick={handleInstall} size="lg" className="w-full gap-2 font-semibold">
                <Download className="w-5 h-5" />
                Instalar agora
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Steps */}
        <Card className="shadow-lg">
          <CardContent className="p-4 sm:p-6">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
              {deferredPrompt ? 'Ou siga os passos:' : 'Como instalar:'}
            </h2>

            <div className="space-y-1">
              {steps.map((step, index) => (
                <div key={index} className="flex gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <step.icon className="w-5 h-5 text-primary" />
                    </div>
                    {index < steps.length - 1 && (
                      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-px h-6 bg-border" />
                    )}
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-semibold text-foreground">{step.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Benefits */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { icon: Smartphone, label: 'Tela cheia' },
            { icon: Download, label: 'Offline' },
            { icon: CheckCircle2, label: 'Auto-update' },
          ].map(({ icon: Icon, label }) => (
            <Card key={label} className="border-border/50">
              <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Platform tabs */}
        <div className="mt-6 flex justify-center gap-2">
          {(['ios', 'android', 'desktop'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                platform === p
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card text-muted-foreground border-border hover:border-foreground/30'
              }`}
            >
              {p === 'ios' ? 'iPhone/iPad' : p === 'android' ? 'Android' : 'Desktop'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Install;
