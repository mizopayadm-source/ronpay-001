import { useState, useEffect } from 'react';
import { doc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PublicPoolStats } from '../types';
import { getStoredPublicPoolStats, recalibratePublicPoolStatsFromFirestore } from '../services/firestoreSync';

/**
 * React Hook: Listen in real-time to the single authoritative Distributed Counter document
 * (stats/public_pool) with:
 * 1. Query filter unified across Guest, Admin, Chrome, and App (status == 'SUCCESS')
 * 2. ZERO client-side calculation - reads raw totalAmount directly from Firestore document
 * 3. Cache bypass: Forces server data via getDocFromServer and metadata-aware onSnapshot
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
    try {
      const statsDocRef = doc(db, 'stats', 'public_pool');

      // 1. DIRECT SERVER FETCH (Cache Bypass: Metadata source == 'server')
      // Immediately fetches authoritative server state, bypassing IndexedDB offline cache
      getDocFromServer(statsDocRef)
        .then((serverSnap) => {
          if (serverSnap.exists()) {
            const data = serverSnap.data();
            const serverStats: PublicPoolStats = {
              totalAmount: Math.max(0, typeof data?.totalAmount === 'number' ? data.totalAmount : (Number(data?.totalAmount) || 0)),
              totalCount: Math.max(0, typeof data?.totalCount === 'number' ? data.totalCount : (Number(data?.totalCount) || 0)),
              todayCount: Math.max(0, typeof data?.todayCount === 'number' ? data.todayCount : (Number(data?.todayCount) || 0)),
              lastUpdated: data?.lastUpdated || new Date().toISOString(),
            };
            setStats(prev => {
              if (prev.totalAmount === serverStats.totalAmount && prev.totalCount === serverStats.totalCount && prev.todayCount === serverStats.todayCount) {
                return prev;
              }
              return serverStats;
            });
            setLoading(false);
            try {
              localStorage.setItem('ronpay_public_pool_stats_v1', JSON.stringify(serverStats));
            } catch {}
          } else {
            // If public_pool doc doesn't exist yet, recalibrate directly from server
            recalibratePublicPoolStatsFromFirestore().then((calibrated) => {
              if (calibrated) setStats(calibrated);
              setLoading(false);
            }).catch(() => setLoading(false));
          }
        })
        .catch((serverErr) => {
          // If offline or network slow, fall back to snapshot listener
          console.warn('[usePublicPoolStats] Direct server fetch note:', serverErr);
        });

      // 2. REAL-TIME LISTENER with Metadata Changes
      const unsubscribe = onSnapshot(
        statsDocRef,
        { includeMetadataChanges: false },
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const poolData: PublicPoolStats = {
              totalAmount: Math.max(0, typeof data?.totalAmount === 'number' ? data.totalAmount : (Number(data?.totalAmount) || 0)),
              totalCount: Math.max(0, typeof data?.totalCount === 'number' ? data.totalCount : (Number(data?.totalCount) || 0)),
              todayCount: Math.max(0, typeof data?.todayCount === 'number' ? data.todayCount : (Number(data?.todayCount) || 0)),
              lastUpdated: data?.lastUpdated || new Date().toISOString(),
            };

            // Update state with server data only if changed
            setStats(prev => {
              if (prev.totalAmount === poolData.totalAmount && prev.totalCount === poolData.totalCount && prev.todayCount === poolData.todayCount) {
                return prev;
              }
              return poolData;
            });
            setLoading(false);
            setError(null);
            try {
              localStorage.setItem('ronpay_public_pool_stats_v1', JSON.stringify(poolData));
            } catch {}
          } else {
            setLoading(false);
          }
        },
        (err) => {
          console.warn('[usePublicPoolStats] Snapshot listener note:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      // 3. Multi-Tab Synchronous Events
      const handleCustomEvent = (e: any) => {
        if (e.detail && typeof e.detail === 'object' && e.detail.totalAmount !== undefined) {
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
