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

