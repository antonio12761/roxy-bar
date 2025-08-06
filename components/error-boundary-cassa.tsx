"use client";

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  lastErrorTime: number;
}

/**
 * Error Boundary Component per Cassa
 * Gestisce errori React con recovery automatico e logging
 */
export class CassaErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private readonly MAX_ERROR_COUNT = 3;
  private readonly ERROR_RESET_TIME = 60000; // 1 minuto
  private readonly AUTO_RETRY_DELAY = 5000; // 5 secondi

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const now = Date.now();
    const { errorCount, lastErrorTime } = this.state;
    
    // Reset counter se è passato abbastanza tempo
    const newErrorCount = 
      now - lastErrorTime > this.ERROR_RESET_TIME ? 1 : errorCount + 1;

    // Log errore
    console.error('CassaErrorBoundary caught error:', error, errorInfo);
    
    // Log dettagliato per produzione
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }

    // Callback personalizzato
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Aggiorna stato
    this.setState({
      error,
      errorInfo,
      errorCount: newErrorCount,
      lastErrorTime: now
    });

    // Auto-retry se non ci sono troppi errori
    if (newErrorCount < this.MAX_ERROR_COUNT && this.props.level === 'component') {
      this.scheduleAutoRetry();
    }

    // Salva in localStorage per debugging
    this.saveErrorToLocalStorage(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;
    
    if (hasError && prevProps.resetKeys !== resetKeys && resetOnPropsChange) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private scheduleAutoRetry = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      console.log('Auto-retrying after error...');
      this.resetErrorBoundary();
    }, this.AUTO_RETRY_DELAY);
  };

  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Invia a servizio di logging esterno (es: Sentry, LogRocket)
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      level: this.props.level || 'component'
    };

    // TODO: Implementare invio a servizio esterno
    console.log('Would send to logging service:', errorData);
  };

  private saveErrorToLocalStorage = (error: Error, errorInfo: ErrorInfo) => {
    try {
      const errors = JSON.parse(localStorage.getItem('cassa_errors') || '[]');
      errors.push({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        level: this.props.level
      });
      
      // Mantieni solo ultimi 10 errori
      if (errors.length > 10) {
        errors.shift();
      }
      
      localStorage.setItem('cassa_errors', JSON.stringify(errors));
    } catch (e) {
      console.error('Failed to save error to localStorage:', e);
    }
  };

  private handleReset = () => {
    this.resetErrorBoundary();
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/cassa';
  };

  private renderErrorFallback = () => {
    const { error, errorInfo, errorCount } = this.state;
    const { level = 'component', isolate } = this.props;

    // Per errori isolati a livello componente
    if (level === 'component' && isolate) {
      return (
        <Alert variant="destructive" className="m-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Errore nel componente</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm">Si è verificato un errore in questo componente.</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={this.handleReset}
              className="mt-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Riprova
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    // Per errori a livello sezione
    if (level === 'section') {
      return (
        <Card className="m-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Errore nella sezione
            </CardTitle>
            <CardDescription>
              Si è verificato un errore in questa sezione dell'applicazione
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm font-medium">Dettagli errore:</p>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                {error?.message}
              </pre>
              {errorCount >= this.MAX_ERROR_COUNT && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Troppi errori consecutivi. Ricarica la pagina.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button variant="outline" onClick={this.handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Riprova
            </Button>
            <Button variant="secondary" onClick={this.handleReload}>
              Ricarica Pagina
            </Button>
          </CardFooter>
        </Card>
      );
    }

    // Per errori a livello pagina (default)
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              Ops! Qualcosa è andato storto
            </CardTitle>
            <CardDescription>
              Si è verificato un errore imprevisto nell'applicazione Cassa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Messaggio errore */}
            <Alert>
              <AlertTitle>Dettagli errore</AlertTitle>
              <AlertDescription>
                <p className="mt-2 text-sm font-mono">
                  {error?.message || 'Errore sconosciuto'}
                </p>
              </AlertDescription>
            </Alert>

            {/* Stack trace in development */}
            {process.env.NODE_ENV === 'development' && error?.stack && (
              <details className="cursor-pointer">
                <summary className="text-sm font-medium">
                  Stack trace (solo sviluppo)
                </summary>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                  {error.stack}
                </pre>
              </details>
            )}

            {/* Component stack */}
            {process.env.NODE_ENV === 'development' && errorInfo?.componentStack && (
              <details className="cursor-pointer">
                <summary className="text-sm font-medium">
                  Component stack (solo sviluppo)
                </summary>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}

            {/* Avviso errori multipli */}
            {errorCount >= this.MAX_ERROR_COUNT && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Troppi errori</AlertTitle>
                <AlertDescription>
                  L'applicazione ha riscontrato troppi errori consecutivi. 
                  Ti consigliamo di ricaricare la pagina.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button 
              variant="default" 
              onClick={this.handleReset}
              disabled={errorCount >= this.MAX_ERROR_COUNT}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Riprova
            </Button>
            <Button variant="secondary" onClick={this.handleReload}>
              Ricarica
            </Button>
            <Button variant="outline" onClick={this.handleGoHome}>
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  };

  render() {
    if (this.state.hasError) {
      // Se c'è un fallback personalizzato, usalo
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Altrimenti usa il fallback predefinito
      return this.renderErrorFallback();
    }

    return this.props.children;
  }
}

/**
 * Hook per utilizzare Error Boundary in componenti funzionali
 */
export function withCassaErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <CassaErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </CassaErrorBoundary>
  );

  WrappedComponent.displayName = 
    `withCassaErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Provider Error Boundary per l'intera app Cassa
 */
export function CassaErrorProvider({ children }: { children: ReactNode }) {
  return (
    <CassaErrorBoundary 
      level="page"
      onError={(error, errorInfo) => {
        // Log globale errori
        console.error('Global Cassa Error:', error, errorInfo);
        
        // Qui potresti inviare a Sentry o altro servizio
        // Sentry.captureException(error, { extra: errorInfo });
      }}
    >
      {children}
    </CassaErrorBoundary>
  );
}