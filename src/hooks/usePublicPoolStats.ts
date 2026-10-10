import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PublicPoolStats } from '../types';

/**
 * React Hook: Compute live stats directly from Supabase transactions table with safe Realtime sync
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
    lastUpdated: new Date().toISOString()
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    try {
      localStorage.removeItem('ronpay_public_pool_stats_v1');
    } catch {}

    const fetchLiveStatsFromSupabase = async () => {
      try {
        const { data, error, count } = await supabase
          .from('transactions')
          .select('amount, timestamp, created_at, status', { count: 'exact' });

        if (error) throw error;

        let totalAmount = 0;
        let todayCount = 0;
        const todayStr = new Date().toISOString().slice(0, 10);

        if (data && Array.isArray(data)) {
          data.forEach((tx: any) => {
            const amt = Number(tx.amount) || Number(tx.total_amount) || 0;
            totalAmount += amt;

            const txDate = (tx.timestamp || tx.created_at || '').slice(0, 10);
            if (txDate === todayStr) {
              todayCount += 1;
            }
          });
        }

        if (isMounted) {
          const liveStats: PublicPoolStats = {
            totalAmount: Math.round(totalAmount * 100) / 100,
            totalCount: count !== null ? count : (data ? data.length : 0),
            todayCount,
            lastUpdated: new Date().toISOString(),
          };

          setStats(liveStats);
          setLoading(false);
          
          // Clear stale cache so it never flashes old numbers on next reload
          try {
            localStorage.setItem('ronpay_public_pool_stats_v1', JSON.stringify(liveStats));
          } catch {}
        }
      } catch (err: any) {
        console.error('[usePublicPoolStats] Error fetching from Supabase:', err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchLiveStatsFromSupabase();

    // Safe Real-time subscription with unique channel name to prevent callback collision errors
    const uniqueChannelName = `public-transactions-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(uniqueChannelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          if (isMounted) {
            fetchLiveStatsFromSupabase();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { stats, loading, error };
}
