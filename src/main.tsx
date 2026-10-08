import './utils/apiConfig';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './utils/serviceWorker';
import { ErrorBoundary } from './components/ErrorBoundary';

// Safe alert safeguard for sandboxed iframe environments
if (typeof window !== 'undefined') {
  const originalAlert = window.alert;
  window.alert = function (msg?: any) {
    try {
      if (originalAlert) originalAlert(msg);
    } catch {
      console.warn('[RonPay Notice]:', msg);
    }
  };

  // Protect against QuotaExceededError on localStorage (Firebase offline mutations, campaign/txn cache, etc.)
  if (window.localStorage) {
    try {
      const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
      window.localStorage.setItem = function (key: string, value: string) {
        try {
          originalSetItem(key, value);
        } catch (e: any) {
          if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || String(e).includes('QuotaExceededError'))) {
            console.warn('[LocalStorage Quota Exceeded] Purging non-critical cache and retrying...');
            try {
              for (let i = window.localStorage.length - 1; i >= 0; i--) {
                const k = window.localStorage.key(i);
                if (k && (k.includes('firestore_mutations') || k.includes('audit_logs') || k.includes('deleted_tx') || k.includes('section_presets'))) {
                  window.localStorage.removeItem(k);
                }
              }
              originalSetItem(key, value);
            } catch (retryErr) {
              console.error('[LocalStorage Quota Exceeded] Retry failed:', retryErr);
            }
          } else {
            throw e;
          }
        }
      };
    } catch (err) {
      console.warn('Could not wrap localStorage.setItem:', err);
    }
  }
}

try {
  registerServiceWorker();
} catch (e) {
  console.warn('[RonPay] Service worker setup bypassed:', e);
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary name="RonPayRoot">
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

