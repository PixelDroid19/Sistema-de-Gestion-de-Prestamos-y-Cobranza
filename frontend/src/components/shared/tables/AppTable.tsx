import type { ReactNode } from 'react';
import { FinancialScheduleTable } from './FinancialScheduleTable';
import { OperationalTable } from './OperationalTable';
import type { AppTableVariant, FinancialTableMode, OperationalTableMode } from './tableTypes';

type AppTableBaseProps = {
  children: ReactNode;
};

export type FinancialAppTableProps = AppTableBaseProps & {
  variant: 'financial';
} & FinancialTableMode;

export type OperationalAppTableProps = AppTableBaseProps & {
  variant: 'operational';
} & OperationalTableMode;

export type AppTableProps = FinancialAppTableProps | OperationalAppTableProps;

/**
 * Punto de entrada único para tablas del backoffice.
 * - `financial`: grillas densas de cuotas / amortización.
 * - `operational`: listados administrativos con scroll, estados y paginación opcionales.
 */
export function AppTable(props: AppTableProps) {
  const { variant, children, ...config } = props;

  if (variant === 'financial') {
    const {
      visibleFrom,
      horizontalScroll,
      embeddedInSurface,
      financialLayout,
      minWidthClassName,
      className,
      surfaceClassName,
      tableClassName,
      'data-tour': dataTour,
      'data-testid': dataTestId,
    } = config as FinancialTableMode;

    return (
      <FinancialScheduleTable
        visibleFrom={visibleFrom}
        horizontalScroll={horizontalScroll}
        embeddedInSurface={embeddedInSurface}
        financialLayout={financialLayout}
        minWidthClassName={minWidthClassName}
        className={className}
        surfaceClassName={surfaceClassName}
        tableClassName={tableClassName}
        data-tour={dataTour}
        data-testid={dataTestId}
      >
        {children}
      </FinancialScheduleTable>
    );
  }

  const {
    isLoading,
    isError,
    hasData,
    loadingContent,
    errorContent,
    emptyContent,
    pagination,
    recordsLabel,
    shell,
    statePresentation,
    footer,
    className,
    surfaceClassName,
    tableClassName,
    minWidthClassName,
    'data-tour': dataTour,
    'data-testid': dataTestId,
    'aria-label': ariaLabel,
  } = config as OperationalTableMode;

  return (
    <OperationalTable
      isLoading={isLoading}
      isError={isError}
      hasData={hasData}
      loadingContent={loadingContent}
      errorContent={errorContent}
      emptyContent={emptyContent}
      pagination={pagination}
      recordsLabel={recordsLabel}
      shell={shell}
      statePresentation={statePresentation}
      footer={footer}
      className={className}
      surfaceClassName={surfaceClassName}
      tableClassName={tableClassName}
      minWidthClassName={minWidthClassName}
      data-tour={dataTour}
      data-testid={dataTestId}
      aria-label={ariaLabel}
    >
      {children}
    </OperationalTable>
  );
}

export function isFinancialTableVariant(variant: AppTableVariant): variant is 'financial' {
  return variant === 'financial';
}

export function isOperationalTableVariant(variant: AppTableVariant): variant is 'operational' {
  return variant === 'operational';
}
