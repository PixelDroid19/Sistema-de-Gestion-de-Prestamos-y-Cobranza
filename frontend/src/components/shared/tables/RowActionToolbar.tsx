import type { ReactNode } from 'react';

type RowActionToolbarProps = {
  variant: 'icon' | 'installment';
  children: ReactNode;
  ariaLabel: string;
  align?: 'start' | 'end' | 'center';
  className?: string;
};

const alignClassNames = {
  start: 'justify-start',
  end: 'justify-end',
  center: 'justify-center',
} as const;

export function RowActionToolbar({
  variant,
  children,
  ariaLabel,
  align = 'end',
  className = '',
}: RowActionToolbarProps) {
  const baseClassName = variant === 'installment'
    ? 'credit-installment-actions flex w-full min-h-9 flex-nowrap items-center gap-2'
    : 'flex w-full min-h-9 flex-nowrap items-center gap-2';

  return (
    <div
      className={`${baseClassName} ${alignClassNames[align]} ${className}`}
      role="toolbar"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
