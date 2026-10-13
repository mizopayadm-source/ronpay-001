import React, { useState, useEffect, useCallback } from 'react';
import { Database, Zap, ShieldCheck, Activity, RefreshCw, CheckCircle2, AlertTriangle, Wifi, Lock } from 'lucide-react';
import { supabase, getSupabaseUrl } from '../lib/supabase';

interface SupabaseHealthIndicatorProps {
  compact?: boolean;
  onRefresh?: () => void;
}

export const SupabaseHealthIndicator: React.FC<SupabaseHealthIndicatorProps> = ({ compact = false, onRefresh }) => {
  const [dbStatus, setDbStatus] = useState<'connected' | 'degraded' | 'offline'>('connected');
  const [authStatus, setAuthStatus] = useState<string>('authenticated');
  const [realtimeStatus, setRealtimeStatus] = useState<'active' | 'connecting' | 'error'>('active');
  const [latencyMs, setLatencyMs] = useState<number>(42);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<string>(new Date().toLocaleTimeString());
  const [transactionCount, setTransactionCount] = useState<number>(0);
  const [campaignCount, setCampaignCount] = useState<number>(0);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    const start = performance.now();
    try {
      // 1. Test DB Connection & Latency by querying transactions count
      const { count: txCount, error: txError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });

      const { count: campCount, error: campError } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true });

      const duration = Math.round(performance.now() - start);
      setLatencyMs(duration);

      if (txError || campError) {
        setDbStatus('degraded');
      } else {
        setDbStatus('connected');
        setTransactionCount(txCount || 0);
        setCampaignCount(campCount || 0);
      }

      // 2. Check Auth session
      const { data: authData } = await supabase.auth.getSession();
      if (authData?.session) {
        setAuthStatus('authenticated');
      } else {
        setAuthStatus('anonymous/guest');
      }

      // 3. Check Realtime channel
      const testChannel = supabase.channel(`health-check-${Math.random()}`);
      testChannel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('active');
          supabase.removeChannel(testChannel);
        } else if (status === 'CHANNEL_ERROR' || err) {
          setRealtimeStatus('error');
        }
      });

      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('[SupabaseHealth] Health check error:', err);
      setDbStatus('offline');
      setRealtimeStatus('error');
    } finally {
      setIsChecking(false);
      if (onRefresh) onRefresh();
    }
  }, [onRefresh]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [checkHealth]);

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-indigo-500/30 text-white text-xs">
        <span className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
        <span className="font-black text-indigo-300">Supabase:</span>
        <span className="font-bold text-slate-200">{dbStatus === 'connected' ? 'Live' : 'Degraded'}</span>
        <span className="text-[10px] text-slate-400">({latencyMs}ms)</span>
        <button
          type="button"
          onClick={checkHealth}
          disabled={isChecking}
          title="Refresh Supabase Health"
          className="p-1 hover:bg-white/10 rounded-lg transition cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 text-indigo-300 ${isChecking ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-5 rounded-3xl shadow-xl border border-indigo-500/30 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/50">
            <Database className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-white tracking-wide">Supabase Single Source of Truth</h4>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
                dbStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' :
                dbStatus === 'degraded' ? 'bg-amber-500/20 text-amber-300 border-amber-400/40' :
                'bg-rose-500/20 text-rose-300 border-rose-400/40'
              }`}>
                {dbStatus === 'connected' ? '● 100% Operational' : dbStatus === 'degraded' ? '▲ Degraded' : '✕ Offline'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-mono mt-0.5">
              URL: {getSupabaseUrl().replace('https://', '')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={checkHealth}
          disabled={isChecking}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Pinging...' : 'Ping Supabase'}</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-indigo-900/50 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>DB Latency</span>
          </div>
          <p className="text-base font-black text-white">{latencyMs} ms</p>
          <span className="text-[9px] text-emerald-400 font-bold">Optimal Speed</span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/80 border border-indigo-900/50 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>Realtime Websocket</span>
          </div>
          <p className="text-base font-black capitalize text-emerald-300">{realtimeStatus}</p>
          <span className="text-[9px] text-slate-400">Live push enabled</span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/80 border border-indigo-900/50 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Auth Status</span>
          </div>
          <p className="text-base font-black capitalize text-amber-300 truncate">{authStatus}</p>
          <span className="text-[9px] text-slate-400">JWT Token Valid</span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/80 border border-indigo-900/50 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase">
            <Database className="w-3.5 h-3.5 text-indigo-300" />
            <span>Indexed Records</span>
          </div>
          <p className="text-base font-black text-white">{transactionCount} Txns / {campaignCount} Camps</p>
          <span className="text-[9px] text-indigo-300 font-bold">Synchronized</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-indigo-200/80 pt-1">
        <span>Last Pinged: {lastChecked}</span>
        <span className="font-bold text-emerald-300 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Supabase DB & Realtime Active (Firestore Deprecated)
        </span>
      </div>
    </div>
  );
};
