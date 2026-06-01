import type { ReactNode } from 'react';

type TableStatusPillProps = {
  children: ReactNode;
  className?: string;
};

export function TableStatusPill({ children, className = '' }: TableStatusPillProps) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}
