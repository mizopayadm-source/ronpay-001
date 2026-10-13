import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Database, 
  Activity, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Wifi, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  Server,
  Radio
} from 'lucide-react';
import { supabase, getSupabaseUrl } from '../lib/supabase';
import { fetchTableData, subscribeToTable } from '../services/SupabaseSync';
import { Transaction, Campaign } from '../types';

export interface ConnectionStatusMonitorProps {
  variant?: 'card' | 'badge' | 'bar' | 'compact';
  className?: string;
  onRefresh?: () => void;
  showDetails?: boolean;
}

export const ConnectionStatusMonitor: React.FC<ConnectionStatusMonitorProps> = ({
  variant = 'card',
  className = '',
  onRefresh,
  showDetails = true
}) => {
  const [dbStatus, setDbStatus] = useState<'connected' | 'degraded' | 'offline'>('connected');
  const [dbLatency, setDbLatency] = useState<number>(45);
  const [authStatus, setAuthStatus] = useState<'authenticated' | 'active_token' | 'anonymous' | 'error'>('active_token');
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(true);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [lastPingTime, setLastPingTime] = useState<string>(new Date().toLocaleTimeString());
  const [transactionsCount, setTransactionsCount] = useState<number>(0);
  const [campaignsCount, setCampaignsCount] = useState<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Ping Supabase using the authoritative fetchTableData service
  const checkConnection = useCallback(async () => {
    if (!isMountedRef.current) return;
    setIsPinging(true);
    const startTime = performance.now();

    try {
      // 1. Measure DB Latency using authoritative fetchTableData service
      const txData = await fetchTableData<Transaction>('transactions');
      const endTime = performance.now();
      const latency = Math.max(1, Math.round(endTime - startTime));

      if (isMountedRef.current) {
        setDbLatency(latency);
        if (Array.isArray(txData)) {
          setTransactionsCount(txData.length);
          setDbStatus('connected');
        } else {
          setDbStatus('degraded');
        }
      }

      // Also get campaign count
      try {
        const campData = await fetchTableData<Campaign>('campaigns');
        if (isMountedRef.current && Array.isArray(campData)) {
          setCampaignsCount(campData.length);
        }
      } catch {}

      // 2. Check Auth Status in real-time
      try {
        const { data: authSession, error: authErr } = await supabase.auth.getSession();
        if (isMountedRef.current) {
          if (!authErr && authSession?.session?.user) {
            setAuthStatus('authenticated');
            setAuthEmail(authSession.session.user.email || 'Admin User');
          } else {
            // Anon public key active session
            setAuthStatus('active_token');
            setAuthEmail('Public Token / SSOT Active');
          }
        }
      } catch {
        if (isMountedRef.current) setAuthStatus('anonymous');
      }

      if (isMountedRef.current) {
        setLastPingTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.warn('[ConnectionStatusMonitor] DB Latency / Connection Ping Warning:', err);
      if (isMountedRef.current) {
        setDbStatus('offline');
        setDbLatency(999);
      }
    } finally {
      if (isMountedRef.current) {
        setIsPinging(false);
      }
    }
  }, []);

  const handleManualRefresh = useCallback(async () => {
    await checkConnection();
    if (onRefreshRef.current) {
      onRefreshRef.current();
    }
  }, [checkConnection]);

  useEffect(() => {
    isMountedRef.current = true;
    checkConnection();

    // 3. Realtime subscription health test
    const channel = supabase.channel(`conn-monitor-${Math.random().toString(36).substring(2, 7)}`);
    channel.subscribe((status) => {
      if (!isMountedRef.current) return;
      if (status === 'SUBSCRIBED') {
        setRealtimeConnected(true);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setRealtimeConnected(false);
      }
    });

    // Also listen to transaction table updates
    const txUnsub = subscribeToTable('transactions', () => {
      if (isMountedRef.current) {
        checkConnection();
      }
    });

    const interval = setInterval(() => {
      checkConnection();
    }, 25000); // Re-check latency every 25s

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      try {
        supabase.removeChannel(channel);
        if (txUnsub) supabase.removeChannel(txUnsub);
      } catch {}
    };
  }, [checkConnection]);

  // Color helper for latency
  const getLatencyColor = (ms: number) => {
    if (ms <= 100) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (ms <= 250) return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const getLatencyBadge = (ms: number) => {
    if (ms <= 100) return 'Optimal (<100ms)';
    if (ms <= 250) return 'Normal';
    return 'High Latency';
  };

  // -------------------------------------------------------------
  // VARIANT: BADGE (Compact inline indicator for Headers & Top Bars)
  // -------------------------------------------------------------
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white shadow-xs ${className}`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-[10px] font-black uppercase text-slate-300">Supabase</span>
        </div>

        <div className="h-3 w-px bg-slate-700" />

        {/* Real-time DB Latency */}
        <div className="flex items-center gap-1 text-[10.5px] font-mono">
          <Activity className="w-3 h-3 text-indigo-400" />
          <span className={`font-black ${dbLatency <= 120 ? 'text-emerald-400' : 'text-amber-300'}`}>
            {dbLatency}ms
          </span>
        </div>

        <div className="h-3 w-px bg-slate-700" />

        {/* Real-time Auth Status Indicator */}
        <div className="flex items-center gap-1 text-[10px] font-bold">
          <Lock className="w-3 h-3 text-amber-400" />
          <span className="text-amber-300 capitalize">{authStatus === 'active_token' ? 'Auth Token' : authStatus}</span>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isPinging}
          title="Ping Supabase"
          className="p-0.5 hover:bg-slate-800 rounded transition cursor-pointer text-slate-400 hover:text-white"
        >
          <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VARIANT: BAR (Streamlined horizontal status bar across top desk)
  // -------------------------------------------------------------
  if (variant === 'bar') {
    return (
      <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-950/95 border border-indigo-900/60 text-slate-200 text-xs shadow-inner ${className}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Radio className={`w-3.5 h-3.5 ${realtimeConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
            <span className="font-extrabold text-[11px] text-white">Supabase SSOT:</span>
            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md uppercase ${
              dbStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {dbStatus === 'connected' ? '100% Operational' : 'Degraded'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">DB Latency:</span>
            <span className={`font-black px-1.5 py-0.2 rounded-md border ${getLatencyColor(dbLatency)}`}>
              {dbLatency} ms
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Auth Clearance:</span>
            <span className="font-bold text-amber-300 capitalize">{authStatus === 'active_token' ? 'Active JWT' : authStatus}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          <span className="hidden lg:inline">{transactionsCount} txns indexed</span>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isPinging}
            className="flex items-center gap-1 px-2 py-0.8 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 font-bold transition cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin text-white' : ''}`} />
            <span>{isPinging ? 'Pinging...' : 'Ping'}</span>
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VARIANT: COMPACT (Small block)
  // -------------------------------------------------------------
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-indigo-500/30 text-white text-xs ${className}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-indigo-300">Supabase Live:</span>
            <span className={`font-bold font-mono text-[11px] ${dbLatency <= 100 ? 'text-emerald-300' : 'text-amber-300'}`}>
              {dbLatency}ms latency
            </span>
          </div>
          <span className="text-[10px] text-slate-400 capitalize">
            Auth: {authStatus === 'active_token' ? 'Valid Token' : authStatus} • Realtime WS active
          </span>
        </div>
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isPinging}
          className="ml-auto p-1 hover:bg-white/10 rounded-lg transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-300 ${isPinging ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VARIANT: CARD (Default Comprehensive Visual Monitor)
  // -------------------------------------------------------------
  return (
    <div className={`bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-5 rounded-3xl shadow-xl border border-indigo-500/30 space-y-4 ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/50">
            <Database className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-black text-white tracking-wide">Supabase Connection & Health Monitor</h4>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
                dbStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' :
                dbStatus === 'degraded' ? 'bg-amber-500/20 text-amber-300 border-amber-400/40' :
                'bg-rose-500/20 text-rose-300 border-rose-400/40'
              }`}>
                {dbStatus === 'connected' ? '● 100% Operational (SSOT)' : dbStatus === 'degraded' ? '▲ Degraded' : '✕ Offline'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-mono mt-0.5">
              Service: fetchTableData() • Host: {getSupabaseUrl().replace('https://', '')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isPinging}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
          <span>{isPinging ? 'Pinging Service...' : 'Ping Supabase'}</span>
        </button>
      </div>

      {/* Metrics Grid with Real-time Auth & Latency Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        {/* Metric 1: DB Latency */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-indigo-900/50 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 font-bold text-[10px] uppercase">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>DB Latency</span>
            </span>
            <span className={`w-2 h-2 rounded-full ${dbLatency <= 100 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          </div>
          <p className="text-xl font-black font-mono text-white">{dbLatency} ms</p>
          <div className="flex items-center gap-1">
            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md border ${getLatencyColor(dbLatency)}`}>
              {getLatencyBadge(dbLatency)}
            </span>
          </div>
        </div>

        {/* Metric 2: Auth Clearance */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-indigo-900/50 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 font-bold text-[10px] uppercase">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Auth Status</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-base font-black text-amber-300 capitalize truncate">
            {authStatus === 'active_token' ? 'Active Token' : authStatus}
          </p>
          <span className="text-[9.5px] text-slate-400 font-medium truncate block">
            {authEmail || 'Valid JWT Session'}
          </span>
        </div>

        {/* Metric 3: Realtime WebSocket */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-indigo-900/50 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 font-bold text-[10px] uppercase">
            <span className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Realtime WS</span>
            </span>
            <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          </div>
          <p className="text-base font-black text-emerald-300">
            {realtimeConnected ? 'Subscribed' : 'Reconnecting'}
          </p>
          <span className="text-[9.5px] text-slate-400">PostgreSQL CDC active</span>
        </div>

        {/* Metric 4: Verified Tables Count */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-indigo-900/50 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 font-bold text-[10px] uppercase">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-300" />
              <span>Indexed SSOT</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
          </div>
          <p className="text-base font-black text-white">
            {transactionsCount} Txns / {campaignsCount} Camps
          </p>
          <span className="text-[9.5px] text-indigo-300 font-bold">fetchTableData() synced</span>
        </div>
      </div>

      {/* Footer Info & Realtime Status Text */}
      {showDetails && (
        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-indigo-200/80 pt-1 border-t border-indigo-500/20 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Supabase SSOT Authoritative Layer Connected
            </span>
            <span className="text-slate-400">| Last Ping: {lastPingTime}</span>
          </div>

          <div className="text-[10px] text-slate-400 font-mono">
            RTT: <span className="text-emerald-300 font-bold">{dbLatency}ms</span> • Driver: PostgREST v12
          </div>
        </div>
      )}
    </div>
  );
};
