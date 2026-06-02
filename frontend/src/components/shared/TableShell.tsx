import React from 'react';
import { OperationalSelect } from './inputs/OperationalSelect';
import { tTerm } from '../../i18n/terminology';

type PaginationState = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

type TableShellProps = React.HTMLAttributes<HTMLDivElement> & {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  loadingContent: React.ReactNode;
  errorContent: React.ReactNode;
  emptyContent: React.ReactNode;
  children: React.ReactNode;
  pagination?: PaginationState;
  recordsLabel: string;
  className?: string;
  contentClassName?: string;
};

export default function TableShell(props: TableShellProps) {
  const {
    isLoading,
    isError,
    hasData,
    loadingContent,
    errorContent,
    emptyContent,
    children,
    pagination,
    recordsLabel,
    className = '',
    contentClassName = '',
    ...rest
  } = props;
  const paginationFrom = pagination ? ((pagination.page - 1) * pagination.pageSize) + 1 : 0;
  const paginationTo = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.totalItems) : 0;

  return (
    <div className={`app-table ${className}`} {...rest}>
      <div className={`overflow-x-auto ${contentClassName}`}>
        {isLoading ? loadingContent : isError ? errorContent : hasData ? children : emptyContent}
      </div>

      {pagination && hasData && !isLoading && !isError && (
        <div className="flex flex-col gap-3 border-t border-border-subtle bg-bg-surface px-4 py-3.5 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <span className="text-text-primary/80">
              {tTerm('common.pagination.summary', {
                from: paginationFrom,
                to: paginationTo,
                total: pagination.totalItems,
                records: recordsLabel,
              })}
            </span>
            {pagination.onPageSizeChange && (
              <label className="flex items-center gap-2">
                <span className="text-text-primary/70">{tTerm('common.pagination.rowsPerPage')}</span>
                <OperationalSelect
                  aria-label={tTerm('common.pagination.rowsPerPage')}
                  value={pagination.pageSize}
                  onChange={(event) => pagination.onPageSizeChange?.(Number(event.target.value))}
                  className="w-28 min-h-9 overflow-hidden rounded-lg border border-border-strong bg-bg-base text-sm"
                  selectClassName="min-h-9 px-2.5 py-1.5 text-sm text-text-primary outline-none"
                >
                  {(pagination.pageSizeOptions ?? [10, 25, 50, 100]).map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </OperationalSelect>
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pagination.page === 1}
              onClick={pagination.onPrev}
              className="min-h-9 rounded-lg border border-border-strong bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-hover-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tTerm('common.pagination.previous')}
            </button>
            <button
              type="button"
              disabled={pagination.page === pagination.totalPages}
              onClick={pagination.onNext}
              className="min-h-9 rounded-lg border border-border-strong bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-hover-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tTerm('common.pagination.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
