import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { captureError } from '@/lib/sentry';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showStack: boolean;
  copied: boolean;
  timestamp: string | null;
  isChunkError: boolean;
}

function isChunkLoadError(error: Error): boolean {
  return (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Loading chunk') ||
    error.name === 'ChunkLoadError'
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showStack: false,
    copied: false,
    timestamp: null,
    isChunkError: false,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const isChunkError = isChunkLoadError(error);
    // Auto-reload uma vez após chunk error — previne loop com sessionStorage
    if (isChunkError && !sessionStorage.getItem('sentinella_chunk_reload')) {
      sessionStorage.setItem('sentinella_chunk_reload', '1');
      window.location.reload();
    }
    return { hasError: true, error, timestamp: new Date().toISOString(), isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
    captureError(error, { componentStack: errorInfo.componentStack ?? undefined });
  }

  componentDidMount() {
    // Limpa a flag após mount bem-sucedido (reload funcionou)
    sessionStorage.removeItem('sentinella_chunk_reload');
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showStack: false, copied: false, timestamp: null });
  };

  handleCopy = () => {
    const { error, errorInfo, timestamp } = this.state;
    const text = [
      `Timestamp: ${timestamp}`,
      `URL: ${window.location.href}`,
      `Erro: ${error?.name}: ${error?.message}`,
      `Stack:\n${error?.stack ?? ''}`,
      `Componente:\n${errorInfo?.componentStack ?? ''}`,
    ].join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, errorInfo, showStack, copied, timestamp, isChunkError } = this.state;
    const route = window.location.pathname;
    const errorType = error.name ?? 'Error';

    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-8">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 max-w-2xl w-full overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-start gap-4 p-6 border-b border-destructive/20">
            <div className="shrink-0 rounded-full bg-destructive/10 p-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-base font-semibold text-foreground">
                  {isChunkError ? 'Nova versão disponível' : 'Algo deu errado'}
                </h2>
                <Badge variant="destructive" className="text-xs font-mono">{errorType}</Badge>
              </div>
              <p className="text-sm text-muted-foreground break-all">
                {isChunkError
                  ? 'O sistema foi atualizado. Recarregue a página para carregar a versão mais recente.'
                  : <span className="font-mono">{error.message}</span>}
              </p>
            </div>
          </div>

          {/* Meta info */}
          <div className="px-6 py-3 bg-muted/30 border-b border-destructive/10 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Rota:</span>{' '}
              <span className="font-mono">{route}</span>
            </div>
            {timestamp && (
              <div>
                <span className="font-medium text-foreground">Horário:</span>{' '}
                <span className="font-mono">{new Date(timestamp).toLocaleTimeString('pt-BR')}</span>
              </div>
            )}
          </div>

          {/* Stack trace toggle */}
          {(error.stack || errorInfo?.componentStack) && (
            <div className="border-b border-destructive/10">
              <button
                onClick={() => this.setState({ showStack: !showStack })}
                className="w-full flex items-center justify-between px-6 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
              >
                <span className="font-medium">Detalhes técnicos (stack trace)</span>
                {showStack ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showStack && (
                <div className="px-6 pb-4 space-y-3">
                  {error.stack && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">JavaScript Stack</p>
                      <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all text-foreground/80 max-h-48 overflow-y-auto">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {errorInfo?.componentStack && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Árvore de componentes</p>
                      <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all text-foreground/80 max-h-40 overflow-y-auto">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 p-4 bg-muted/10">
            <Button onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
            <Button onClick={this.handleCopy} variant="outline" className="gap-2">
              <Copy className="h-4 w-4" />
              {copied ? 'Copiado!' : 'Copiar diagnóstico'}
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => window.location.reload()}
            >
              Recarregar página
            </Button>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center max-w-md">
          Se o problema persistir, copie o diagnóstico e envie para o suporte com a rota e horário do erro.
        </p>
      </div>
    );
  }
}
