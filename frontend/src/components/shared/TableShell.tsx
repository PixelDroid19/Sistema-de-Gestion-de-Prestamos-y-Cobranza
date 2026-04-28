import React from 'react';

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

  return (
    <div className={`app-table ${className}`} {...rest}>
      <div className={`overflow-x-auto ${contentClassName}`}>
        {isLoading ? loadingContent : isError ? errorContent : hasData ? children : emptyContent}
      </div>

      {pagination && hasData && !isLoading && !isError && (
        <div className="flex flex-col gap-3 border-t border-border-subtle bg-bg-surface px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <span>
              Mostrando {((pagination.page - 1) * pagination.pageSize) + 1} a {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} de {pagination.totalItems} {recordsLabel}
            </span>
            {pagination.onPageSizeChange && (
              <label className="flex items-center gap-2">
                <span>Filas por página</span>
                <select
                  value={pagination.pageSize}
                  onChange={(event) => pagination.onPageSizeChange?.(Number(event.target.value))}
                  className="rounded-lg border border-border-subtle bg-bg-base px-2 py-1 text-text-primary"
                >
                  {(pagination.pageSizeOptions ?? [10, 25, 50, 100]).map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button
              disabled={pagination.page === 1}
              onClick={pagination.onPrev}
              className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 font-medium hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              disabled={pagination.page === pagination.totalPages}
              onClick={pagination.onNext}
              className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 font-medium hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
