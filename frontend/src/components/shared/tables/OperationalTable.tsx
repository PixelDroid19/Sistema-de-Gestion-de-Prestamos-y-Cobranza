import type { ReactNode } from 'react';
import TableShell from '../TableShell';
import type { OperationalTableMode } from './tableTypes';
import { resolveUseTableShell } from './tableTypes';

type OperationalTableProps = {
  children: ReactNode;
} & OperationalTableMode;

export function OperationalTable({
  children,
  isLoading = false,
  isError = false,
  hasData = true,
  loadingContent,
  errorContent,
  emptyContent,
  pagination,
  recordsLabel = '',
  shell = 'auto',
  statePresentation = 'inline',
  footer,
  className = 'data-table-surface',
  surfaceClassName = '',
  tableClassName = 'w-full text-sm text-left',
  minWidthClassName = 'min-w-[760px]',
  'data-tour': dataTour,
  'data-testid': dataTestId,
  'aria-label': ariaLabel,
}: OperationalTableProps) {
  const table = (
    <table
      data-tour={dataTour}
      data-testid={dataTestId}
      aria-label={ariaLabel}
      className={`${minWidthClassName} ${tableClassName}`}
    >
      {children}
    </table>
  );

  const useShell = resolveUseTableShell({
    shell,
    statePresentation,
    pagination,
    loadingContent,
    errorContent,
    emptyContent,
  });

  const shellStatesActive = statePresentation === 'shell'
    || loadingContent != null
    || errorContent != null
    || emptyContent != null;

  if (useShell) {
    return (
      <div className={footer ? className : undefined}>
        <TableShell
          className={footer ? '' : className}
          contentClassName={surfaceClassName}
          isLoading={shellStatesActive ? isLoading : false}
          isError={shellStatesActive ? isError : false}
          hasData={shellStatesActive ? hasData : true}
          loadingContent={shellStatesActive ? loadingContent : null}
          errorContent={shellStatesActive ? errorContent : null}
          emptyContent={shellStatesActive ? emptyContent : null}
          pagination={pagination}
          recordsLabel={recordsLabel}
        >
          {table}
        </TableShell>
        {footer}
      </div>
    );
  }

  return (
    <div className={`${className} ${surfaceClassName}`}>
      <div className="overflow-x-auto">{table}</div>
      {footer}
    </div>
  );
}
