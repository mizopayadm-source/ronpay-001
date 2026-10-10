import { useState, useEffect } from 'react';
import { PublicPoolStats } from '../types';
import { fetchSupabaseFundPool } from '../services/supabaseService';
import { getStoredPublicPoolStats } from '../services/firestoreSync';

/**
 * React Hook: Authoritative Real-Time Public Fund Pool Statistics
 * Powered by Supabase as Absolute Primary Store with instantaneous multi-tab event sync
 */
export function usePublicPoolStats(): {
  stats: PublicPoolStats;
  loading: boolean;
  error: string | null;
} {
  const [stats, setStats] = useState<PublicPoolStats>({
    totalAmount: 0,
    totalCount: 0,
    todayCount: 0,
    lastUpdated: new Date().toISOString(),
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // 1. DIRECT FETCH FROM SUPABASE PRIMARY STORE
    fetchSupabaseFundPool('public_pool')
      .then((poolData) => {
        if (!isMounted) return;
        if (poolData) {
          setStats(prev => {
            if (prev.totalAmount === poolData.totalAmount && 
                prev.totalCount === poolData.totalCount && 
                prev.todayCount === poolData.todayCount) {
              return prev;
            }
            return poolData;
          });
          try {
            localStorage.setItem('ronpay_public_pool_stats_v1', JSON.stringify(poolData));
          } catch {}
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[usePublicPoolStats] Supabase fund pool note:', err);
        setLoading(false);
      });

    // 2. REAL-TIME MULTI-TAB & SUPABASE WEBSOCKET EVENT LISTENER
    const handleStatsEvent = (e: any) => {
      if (e?.detail && typeof e.detail === 'object' && e.detail.totalAmount !== undefined) {
        const newAmt = Math.max(0, Number(e.detail.totalAmount) || 0);
        const newCnt = Math.max(0, Number(e.detail.totalCount) || 0);
        const newToday = Math.max(0, Number(e.detail.todayCount) || 0);

        setStats(prev => {
          if (prev.totalAmount === newAmt && prev.totalCount === newCnt && prev.todayCount === newToday) {
            return prev;
          }
          return {
            ...prev,
            totalAmount: newAmt,
            totalCount: newCnt,
            todayCount: newToday,
            lastUpdated: e.detail.lastUpdated || new Date().toISOString(),
          };
        });
        setLoading(false);
      }
    };

    window.addEventListener('ronpay_stats_updated', handleStatsEvent);
    window.addEventListener('ronpay-stats-updated', handleStatsEvent);

    return () => {
      isMounted = false;
      window.removeEventListener('ronpay_stats_updated', handleStatsEvent);
      window.removeEventListener('ronpay-stats-updated', handleStatsEvent);
    };
  }, []);

  return { stats, loading, error };
}
