import React, { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
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

  private handleClearCacheAndReload = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && (k.startsWith('ronpay_') || k.includes('firestore') || k.includes('cache'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => window.localStorage.removeItem(k));
      }
    } catch {}
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isRoot = this.props.name === 'RonPayRoot';

      if (isRoot) {
        return (
          <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-900 text-white text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center mb-4 shadow-lg shadow-orange-500/10">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold mb-3 border border-slate-700">
              <span>RonPay Recovery Mode</span>
            </div>
            <h1 className="text-xl font-extrabold text-white mb-2">
              App hi chawlh lailawk a ngai tlat mai
            </h1>
            <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
              Screen hi crash/black screen awm lovin safe mode-ah a in-switch e. Khawngaihin hnuai ami hi hmet la, a pangngaiin a in-load leh ang.
            </p>
            {this.state.error && (
              <div className="w-full max-w-md bg-slate-950 border border-slate-800 text-orange-300 p-3 rounded-xl text-[11px] font-mono text-left mb-6 overflow-x-auto max-h-36">
                {this.state.error.toString()}
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-md active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>En Tha Leh Rawh (Retry)</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
              >
                <Home className="w-4 h-4" />
                <span>App Refresh</span>
              </button>
            </div>
            <button
              type="button"
              onClick={this.handleClearCacheAndReload}
              className="mt-4 text-[11px] text-slate-400 hover:text-slate-200 underline transition cursor-pointer"
            >
              Cache fai fai a reload rawh (Reset Corrupted Session)
            </button>
          </div>
        );
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
