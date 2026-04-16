import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, X, ArrowRight, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: 'Funcionalidades', href: '/#funcionalidades' },
  { label: 'Como funciona', href: '/#como-funciona' },
  { label: 'Contato', href: '/#contato' },
];

const navLinkFocusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg';

function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAnchor = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith('/#') && location.pathname === '/') {
      const id = href.slice(2);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'bg-background/95 backdrop-blur-md border-b border-border/60 shadow-sm'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            to="/"
            className={cn('shrink-0 flex items-center gap-1.5 group', navLinkFocusClass)}
            aria-current={location.pathname === '/' ? 'page' : undefined}
          >
            <Logo
              className={cn(
                'text-base transition-colors duration-200',
                scrolled ? 'text-foreground' : 'text-white'
              )}
              iconSize={28}
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Seções da página inicial">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                onClick={() => handleAnchor(link.href)}
                className={cn(
                  'px-3.5 py-2 text-sm font-medium rounded-lg transition-colors duration-150',
                  navLinkFocusClass,
                  scrolled
                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/denunciar" className={navLinkFocusClass}>
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  'gap-1.5 text-sm font-semibold rounded-xl h-9 px-4 transition-all duration-200',
                  scrolled
                    ? 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20'
                    : 'border-amber-300/60 text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-300 backdrop-blur-sm'
                )}
              >
                <Megaphone className="w-3.5 h-3.5" />
                Denunciar foco
              </Button>
            </Link>
            <Link to="/login" className={navLinkFocusClass}>
              <Button
                size="sm"
                variant={scrolled ? 'default' : 'outline'}
                className={cn(
                  'gap-1.5 text-sm font-semibold rounded-xl h-9 px-4 transition-all duration-200',
                  !scrolled &&
                    'border-white/40 text-white bg-white/10 hover:bg-white/20 hover:border-white/60 backdrop-blur-sm'
                )}
              >
                Acessar sistema
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  'md:hidden p-2 rounded-lg transition-colors',
                  navLinkFocusClass,
                  scrolled
                    ? 'text-foreground hover:bg-muted/60'
                    : 'text-white hover:bg-white/10'
                )}
                aria-label="Abrir menu de navegação"
                aria-expanded={mobileOpen}
                aria-controls="public-mobile-nav"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0" id="public-mobile-nav">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                  <Logo className="text-base text-foreground" iconSize={26} />
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors',
                      navLinkFocusClass
                    )}
                    aria-label="Fechar menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <nav className="flex flex-col gap-1 p-4 flex-1" aria-label="Seções">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.label}
                      to={link.href}
                      onClick={() => handleAnchor(link.href)}
                      className={cn(
                        'px-4 py-3 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/60 rounded-xl transition-colors',
                        navLinkFocusClass
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div className="p-4 border-t border-border/60 space-y-2">
                  <Link to="/denunciar" onClick={() => setMobileOpen(false)} className={cn('block', navLinkFocusClass)}>
                    <Button variant="outline" className="w-full gap-2 rounded-xl font-semibold border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20">
                      <Megaphone className="w-4 h-4" />
                      Denunciar foco de dengue
                    </Button>
                  </Link>
                  <Link to="/login" onClick={() => setMobileOpen(false)} className={cn('block', navLinkFocusClass)}>
                    <Button className="w-full gap-2 rounded-xl font-semibold">
                      Acessar sistema
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

const PublicFooter = React.forwardRef<HTMLElement>((_props, ref) => {
  const currentYear = new Date().getFullYear();
  const location = useLocation();

  const handleAnchor = (href: string) => {
    if (!href.startsWith('/#')) return;
    if (location.pathname !== '/') return;
    const id = href.slice(2);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer ref={ref} className="border-t border-border/60 bg-card/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-2 max-w-xs">
            <Logo className="text-base text-foreground" iconSize={28} />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Plataforma Sentinella para vigilância entomológica, levantamentos e ações em campo nas
              prefeituras.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Rodapé">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                onClick={() => handleAnchor(link.href)}
                className={cn(
                  'text-sm text-muted-foreground hover:text-foreground transition-colors',
                  navLinkFocusClass
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/denunciar"
              className={cn(
                'text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors flex items-center gap-1',
                navLinkFocusClass
              )}
            >
              <Megaphone className="w-3.5 h-3.5" />
              Denunciar foco
            </Link>
            <Link
              to="/login"
              className={cn(
                'text-sm text-muted-foreground hover:text-foreground transition-colors',
                navLinkFocusClass
              )}
            >
              Acessar sistema
            </Link>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {currentYear} Sentinella. Solução para prefeituras e operação em saúde pública.
          </p>
          <p className="text-xs text-muted-foreground">Monitoramento e resposta a focos de arboviroses</p>
        </div>
      </div>
    </footer>
  );
});
PublicFooter.displayName = 'PublicFooter';

/** Rola até o elemento do hash quando a rota é `/` (ex.: link de outra página para `/#contato`). */
function useScrollToHashOnHome() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/') return;
    const id = location.hash.replace(/^#/, '');
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => clearTimeout(t);
  }, [location.pathname, location.hash]);
}

export function PublicLayout() {
  useScrollToHashOnHome();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <a
        href="#main-content"
        className={cn(
          'fixed left-4 top-0 z-[200] -translate-y-full focus:translate-y-4 transition-transform',
          'rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg',
          'outline-none ring-offset-2 focus:ring-2 focus:ring-primary focus:ring-offset-2'
        )}
      >
        Pular para o conteúdo
      </a>
      <PublicHeader />
      <main id="main-content" className="flex-1 outline-none" tabIndex={-1}>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

export default PublicLayout;
