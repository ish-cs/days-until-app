import React, { useEffect } from 'react';

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        padding: '10px 18px', borderRadius: 12, fontSize: 13,
        background: toast.type === 'success' ? 'rgba(134,239,172,0.12)' : 'rgba(248,113,113,0.12)',
        border: `1px solid ${toast.type === 'success' ? 'rgba(134,239,172,0.3)' : 'rgba(248,113,113,0.3)'}`,
        backdropFilter: 'blur(20px)', color: 'var(--ink-0)', zIndex: 200,
        animation: 'fadeIn 200ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {toast.message}
    </div>
  );
}
