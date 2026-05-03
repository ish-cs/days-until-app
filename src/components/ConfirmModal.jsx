import React, { useEffect } from 'react';

export default function ConfirmModal({ message, onConfirm, onCancel }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
      else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="modal glass" style={{ maxWidth: 380 }}>
        <p style={{ textAlign: 'center', color: 'var(--ink-1)', marginBottom: 24, fontSize: 15, margin: '0 0 24px' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            className="btn btn-danger"
            onClick={onConfirm}
          >
            Confirm
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
