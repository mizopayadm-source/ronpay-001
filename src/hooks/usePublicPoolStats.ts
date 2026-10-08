import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PublicPoolStats } from '../types';
import { getStoredPublicPoolStats } from '../services/firestoreSync';

/**
 * React Hook: Listen in real-time to the single authoritative Distributed Counter document
 * (stats/public_pool) with ZERO local document loops and ZERO cache discrepancies across devices.
 */
export function usePublicPoolStats(): {
  stats: PublicPoolStats;
  loading: boolean;
  error: string | null;
} {
  const [stats, setStats] = useState<PublicPoolStats>(() => getStoredPublicPoolStats());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Direct onSnapshot on stats/public_pool document (Costs ONLY 1 Read)
    try {
      const statsDocRef = doc(db, 'stats', 'public_pool');
      const unsubscribe = onSnapshot(
        statsDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const poolData: PublicPoolStats = {
              totalAmount: Number(data?.totalAmount) || 0,
              totalCount: Number(data?.totalCount) || 0,
              lastUpdated: data?.lastUpdated || new Date().toISOString(),
              todayCount: Number(data?.todayCount) || 0,
            };
            setStats(poolData);
            setLoading(false);
            setError(null);
          } else {
            // Initial fallback
            setLoading(false);
          }
        },
        (err) => {
          console.warn('[usePublicPoolStats] Snapshot note:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      // Listen to multi-tab broadcast sync events as well
      const handleCustomEvent = (e: any) => {
        if (e.detail) {
          setStats(e.detail);
        }
      };
      window.addEventListener('ronpay_stats_updated', handleCustomEvent);
      window.addEventListener('ronpay-stats-updated', handleCustomEvent);

      return () => {
        unsubscribe();
        window.removeEventListener('ronpay_stats_updated', handleCustomEvent);
        window.removeEventListener('ronpay-stats-updated', handleCustomEvent);
      };
    } catch (err: any) {
      setError(err?.message || 'Error subscribing to stats');
      setLoading(false);
    }
  }, []);

  return { stats, loading, error };
}
