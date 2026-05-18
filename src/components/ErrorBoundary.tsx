import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center bg-bg-primary p-8">
          <div className="max-w-lg rounded-xl border border-border-subtle bg-bg-secondary p-8 text-center">
            <div className="text-base font-semibold tracking-tight text-red-400">
              Something went wrong
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              {this.state.error?.message ?? 'An unexpected error occurred while rendering.'}
            </p>
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-border-subtle bg-white/[0.02] p-3 text-left text-xs text-text-muted">
              {this.state.error?.stack}
            </pre>
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="secondary" onClick={this.reset}>
                Try again
              </Button>
              <Button onClick={() => window.location.reload()}>
                Reload page
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
