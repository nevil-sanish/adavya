import React from 'react';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading Adavya...',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <div className="relative">
        <div
          className={`${sizeClasses[size]} border-zinc-700 border-t-zinc-100 rounded-full animate-spin`}
        />
        <div className="absolute inset-0 rounded-full blur-sm bg-zinc-400/10 animate-pulse pointer-events-none" />
      </div>
      {label && <p className="text-xs font-medium tracking-wider text-zinc-400 uppercase">{label}</p>}
    </div>
  );
};
