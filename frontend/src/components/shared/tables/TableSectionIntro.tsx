import type { ReactNode } from 'react';

type TableSectionIntroProps = {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  /** Renders inside a shared `.data-table-surface` panel (no extra outer border). */
  embedded?: boolean;
  className?: string;
};

export function TableSectionIntro({
  title,
  description,
  aside,
  embedded = false,
  className = '',
}: TableSectionIntroProps) {
  return (
    <div
      className={[
        embedded ? 'table-panel-intro' : 'border-b border-border-subtle pb-4',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="m-0 text-base font-semibold text-text-primary">{title}</h3>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>
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
