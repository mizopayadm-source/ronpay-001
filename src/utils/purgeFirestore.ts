import { collection, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Operation timed out')), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function clearAllFirestoreTransactionsAndStats() {
  try {
    console.log('Starting full transaction & stats reset (Server, Supabase, LocalStorage & Firestore)...');
    let count = 0;

    // 1. Clear Server and Supabase transactions first via backend purge endpoint with timeout
    try {
      const resp = await withTimeout(fetch('/api/transactions/purge-all', { method: 'POST' }), 5000);
      const data = await resp.json();
      if (data && data.success) {
        count = data.count || data.deletedCount || 0;
        console.log('Server & Supabase purge successful:', data.message);
      }
    } catch (e) {
      console.error('Server purge-all endpoint failed or timed out:', e);
    }

    // 2. Clear local storage transactions & stats thoroughly across all versions (v4, v3, v2, v1)
    try {
      localStorage.removeItem('ronpay_transactions_v4');
      localStorage.removeItem('ronpay_transactions_v3');
      localStorage.removeItem('ronpay_transactions_v2');
      localStorage.removeItem('ronpay_transactions');
      localStorage.removeItem('ronpay_deleted_tx_ids_v1');
      localStorage.removeItem('ronpay_deleted_tx_ids');
      localStorage.removeItem('ronpay_supabase_pending_txs');
      localStorage.removeItem('ronpay_incremented_tx_ids');
      localStorage.removeItem('RONPAY_LAST_CASH_TXN');
      localStorage.removeItem('RONPAY_LAST_CONFIRMED_TXN');
      
      // Also clear any other local storage keys containing txn, transaction, or pending
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) {
            const l = k.toLowerCase();
            if (l.includes('txn') || l.includes('transaction') || l.includes('pending') || l.includes('incremented')) {
              keysToRemove.push(k);
            }
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      }

      localStorage.setItem('ronpay_hard_purge_timestamp_v1', String(Date.now()));
      localStorage.setItem('ronpay_transactions_v4', JSON.stringify([]));
      localStorage.setItem('ronpay_transactions_v2', JSON.stringify([]));
      localStorage.setItem('ronpay_public_pool_stats_v1', JSON.stringify({
        totalAmount: 0,
        totalCount: 0,
        todayCount: 0,
        lastUpdated: new Date().toISOString()
      }));
    } catch (e) {
      console.error('Local storage purge failed:', e);
    }

    // 3. Clear Firestore transactions with timeout (non-blocking if offline/timeout)
    try {
      await withTimeout(async function() {
        const txSnap = await getDocs(collection(db, 'transactions'));
        let batch = writeBatch(db);
        let fsCount = 0;

        txSnap.forEach((docSnap) => {
          batch.delete(docSnap.ref);
          fsCount++;
        });

        if (fsCount > 0) {
          await batch.commit();
          count = Math.max(count, fsCount);
        }

        // Reset public pool stats to 0 in Firestore
        await setDoc(doc(db, 'stats', 'public_pool'), {
          totalAmount: 0,
          totalCount: 0,
          todayCount: 0,
          lastUpdated: new Date().toISOString()
        });

        // Reset system tombstones
        await setDoc(doc(db, 'system_metadata', 'tombstones'), {
          deleted_transactions: [],
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }(), 4000);
    } catch (fsErr) {
      console.warn('Firestore purge skipped/failed (offline or timed out):', fsErr);
    }

    console.log(`Successfully purged transactions. Count: ${count}`);
    return { success: true, count };
  } catch (err: any) {
    console.error('Failed to clear transactions:', err);
    return { success: false, error: err?.message || String(err) };
  }
}
