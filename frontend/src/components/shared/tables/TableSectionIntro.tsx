import type { ReactNode } from 'react';

type TableSectionIntroProps = {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  /** Renders inside a shared `.data-table-surface` panel (no extra outer border). */
  embedded?: boolean;
  /** Tighter intro for dense operational panels (e.g. credit calendar). */
  compact?: boolean;
  className?: string;
};

export function TableSectionIntro({
  title,
  description,
  aside,
  embedded = false,
  compact = false,
  className = '',
}: TableSectionIntroProps) {
  return (
    <div
      className={[
        embedded ? 'table-panel-intro' : 'border-b border-border-subtle pb-4',
        compact ? 'table-panel-intro--compact' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className={`m-0 font-semibold text-text-primary ${compact ? 'text-sm' : 'text-base'}`}>{title}</h3>
          {description ? (
            <p className={`mt-1 max-w-3xl text-text-secondary ${compact ? 'text-xs leading-5' : 'text-sm leading-6'}`}>{description}</p>
          ) : null}
        </div>
        {aside ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs font-medium lg:max-w-[min(100%,28rem)] lg:justify-end">
            {aside}
          </div>
        ) : null}
      </div>
    </div>
  );
}
