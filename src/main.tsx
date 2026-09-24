import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './utils/serviceWorker';
import { ErrorBoundary } from './components/ErrorBoundary';

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

