import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Uncaught error in ${this.props.name || 'Component'}:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[300px] w-full flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-3xl text-center shadow-xs my-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 mb-1">
            Thil fel lo a awm tlat mai
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mb-4">
            Component en lai ({this.props.name || 'View'}) hi a in-load hleithei lo a ni e. Khawngaihin refresh rawh le.
          </p>
          {this.state.error && (
            <div className="w-full max-w-md bg-slate-900 text-amber-400 p-2.5 rounded-xl text-[10px] font-mono text-left mb-4 overflow-x-auto">
              {this.state.error.toString()}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>En Tha Leh Rawh</span>
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <Home className="w-3.5 h-3.5" />
              <span>App Refresh</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
