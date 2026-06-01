import type { ReactNode } from 'react';
import { DataTableSurface } from '../shared/Surfaces';
import { AppTable, TableSectionIntro, TABLE_EMBEDDED_SHELL_CLASS } from '../shared/tables';
import type { AppTableVariant, OperationalTableMode } from '../shared/tables';

type ReportDataTableSectionProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Children must be thead/tbody fragments only (no nested table element). */
  tableVariant?: AppTableVariant;
  minWidthClassName?: string;
} & Pick<OperationalTableMode, 'pagination' | 'shell' | 'statePresentation' | 'isLoading' | 'isError' | 'hasData' | 'loadingContent' | 'errorContent' | 'emptyContent' | 'recordsLabel'>;

/** Table block with an optional compact caption; avoids duplicating the main tab panel title. */
export function ReportDataTableSection({
  title,
  subtitle,
  children,
  footer,
  tableVariant = 'operational',
  minWidthClassName,
  pagination,
  shell,
  statePresentation,
  isLoading,
  isError,
  hasData,
  loadingContent,
  errorContent,
  emptyContent,
  recordsLabel,
}: ReportDataTableSectionProps) {
  const embeddedShell = TABLE_EMBEDDED_SHELL_CLASS;

  return (
    <DataTableSurface>
      {title ? (
        <TableSectionIntro embedded title={title} description={subtitle} />
      ) : null}
      {tableVariant === 'financial' ? (
        <AppTable
          variant="financial"
          visibleFrom="always"
          className={embeddedShell}
          surfaceClassName={embeddedShell}
          horizontalScroll={Boolean(minWidthClassName)}
          minWidthClassName={minWidthClassName || 'min-w-[880px]'}
        >
          {children}
        </AppTable>
      ) : (
        <AppTable
          variant="operational"
          className={embeddedShell}
          surfaceClassName={embeddedShell}
          minWidthClassName={minWidthClassName || 'min-w-full'}
          pagination={pagination}
          shell={shell}
          statePresentation={statePresentation}
          isLoading={isLoading}
          isError={isError}
          hasData={hasData}
          loadingContent={loadingContent}
          errorContent={errorContent}
          emptyContent={emptyContent}
          recordsLabel={recordsLabel}
          footer={footer}
        >
          {children}
        </AppTable>
      )}
    </DataTableSurface>
  );
}
