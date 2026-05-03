import React from 'react';

export default function AuthScreen({ onLogin }) {
  return (
    <main className="auth-screen">
      <div className="glass auth-card">
        <h1 className="serif auth-title">Days Until…</h1>
        <p style={{ color: 'var(--ink-2)', marginBottom: 32 }}>Track what matters.</p>
        <button type="button" className="btn auth-signin" onClick={onLogin}>
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
