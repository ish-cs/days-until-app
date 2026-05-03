import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

/**
 * Stale SW → cached index.html / wrong JS hash → UI missing pieces after reload.
 * Dev: unregister ASAP + never register so Vite HMR stays authoritative.
 * Prod: register after load; sw.js never caches itself (see public/sw.js).
 */
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) =>
    Promise.all(regs.map((r) => r.unregister()))
  );
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
