import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Global error handler to catch render errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error || event.message);
  document.getElementById('root')!.innerHTML = `<pre style="color: red; padding: 20px;">${event.error?.stack || event.message}</pre>`;
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  document.getElementById('root')!.innerHTML = `<pre style="color: red; padding: 20px;">${event.reason?.stack || event.reason}</pre>`;
});

// Build marker: lets the page assert which bundle the SW is actually serving
// (autoUpdate serves the previous precache on the first reload after a build)
(globalThis as Record<string, unknown>).__DZ_BUILD = 'wallblood-solid-v2';

registerSW({
  immediate: true,
  onNeedRefresh() {},
  onOfflineReady() {
    console.log('O² in Apocalypse ready for offline combat');
  },
  onUpdate(registration) {
    // A newer build is installed in the service worker cache. Because
    // autoUpdate precaches it, the browser would otherwise keep serving the
    // old bundle — the exact cause of the "loading screen not showing"
    // symptom. Force a hard reload so the latest code always runs.
    console.log('[SW] New build available, reloading...');
    window.location.reload(true);
  },
});

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e) {
  console.error('Root render error:', e);
  document.getElementById('root')!.innerHTML = `<pre style="color: red; padding: 20px;">${e instanceof Error ? e.stack : String(e)}</pre>`;
}
