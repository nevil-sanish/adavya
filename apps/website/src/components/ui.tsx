import React from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, WifiOff } from 'lucide-react';

export const Card: React.FC<{ title?: React.ReactNode; aside?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  title,
  aside,
  className = '',
  children,
}) => (
  <section className={`bg-zinc-900 border border-zinc-800 rounded-[12px] p-5 ${className}`}>
    {(title || aside) && (
      <header className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-zinc-800/80">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h2>
        {aside && <div className="text-[11px] text-zinc-500 font-mono">{aside}</div>}
      </header>
    )}
    {children}
  </section>
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger'; busy?: boolean };

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', busy, className = '', children, disabled, ...rest }) => {
  const styles = {
    primary: 'bg-white text-zinc-950 hover:bg-zinc-200',
    secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700',
    danger: 'bg-red-500/90 text-white hover:bg-red-500',
  }[variant];
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
};

type Tone = 'error' | 'success' | 'info' | 'warning';

export const Banner: React.FC<{ tone: Tone; children: React.ReactNode; action?: React.ReactNode }> = ({ tone, children, action }) => {
  const styles: Record<Tone, string> = {
    error: 'border-red-400/30 bg-red-400/10 text-red-200',
    success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    info: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
    warning: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  };
  const Icon = { error: AlertCircle, success: CheckCircle2, info: Info, warning: WifiOff }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${styles[tone]}`}>
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 leading-5">{children}</div>
      {action}
    </div>
  );
};

export const FullScreenMessage: React.FC<{ title: string; children?: React.ReactNode; spinner?: boolean }> = ({ title, children, spinner }) => (
  <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
    <div className="max-w-md text-center space-y-3">
      {spinner && <Loader2 aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-zinc-400" />}
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="text-sm text-zinc-400 space-y-3">{children}</div>}
    </div>
  </main>
);
