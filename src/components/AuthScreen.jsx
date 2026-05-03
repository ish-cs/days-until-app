import React from 'react';

export default function AuthScreen({ onLogin }) {
  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass" style={{ padding: 48, textAlign: 'center', maxWidth: 400, margin: 16 }}>
        <h1 className="serif" style={{ fontSize: 48, marginBottom: 8, margin: '0 0 8px' }}>Days Until…</h1>
        <p style={{ color: 'var(--ink-2)', marginBottom: 32 }}>Track what matters.</p>
        <button className="btn" onClick={onLogin} style={{ width: '100%', padding: '12px 24px', fontSize: 15 }}>
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
