import React from 'react';

type PaginationState = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
};

type TableShellProps = {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  loadingContent: React.ReactNode;
  errorContent: React.ReactNode;
  emptyContent: React.ReactNode;
  children: React.ReactNode;
  pagination?: PaginationState;
  recordsLabel: string;
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
  } = props;

  return (
    <>
      <div className="overflow-x-auto">
        {isLoading ? loadingContent : isError ? errorContent : hasData ? children : emptyContent}
      </div>

      {pagination && hasData && !isLoading && !isError && (
        <div className="mt-4 flex justify-between items-center text-sm text-text-secondary">
          <div>
            Mostrando {((pagination.page - 1) * pagination.pageSize) + 1} a {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} de {pagination.totalItems} {recordsLabel}
          </div>
          <div className="flex gap-2">
            <button
              disabled={pagination.page === 1}
              onClick={pagination.onPrev}
              className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              disabled={pagination.page === pagination.totalPages}
              onClick={pagination.onNext}
              className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </>
  );
}
