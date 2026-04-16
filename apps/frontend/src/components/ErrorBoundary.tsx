import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { captureError } from '@/lib/sentry';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary: captura erros na árvore de componentes e exibe fallback.
 * Padrão frontend: evita tela branca e permite "Try again".
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // QW-19: envia para Sentry em produção (inativo se DSN não configurado)
    captureError(error, { componentStack: errorInfo.componentStack ?? undefined });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 max-w-md w-full">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground mb-4 break-words">
              {this.state.error.message}
            </p>
            <Button onClick={this.handleRetry} variant="outline" className="w-full sm:w-auto">
              Tentar novamente
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
