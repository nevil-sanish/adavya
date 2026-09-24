import React from 'react';

export const Loading: React.FC<{ label: string }> = ({ label }) => (
  <main className="center" style={{ justifyContent: 'center' }}>
    <div className="spinner" aria-hidden="true" />
    <p className="muted">{label}</p>
  </main>
);

export const Banner: React.FC<{ tone: 'error' | 'warn' | 'info' | 'ok'; children: React.ReactNode }> = ({ tone, children }) => (
  <div className={`banner ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    {children}
  </div>
);

export function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
