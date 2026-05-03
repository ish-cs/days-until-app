import React, { useEffect } from 'react';

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        'toast-popup glass'
        + (toast.type === 'success' ? ' toast-popup--success' : ' toast-popup--error')
      }
    >
      {toast.message}
    </div>
  );
}
