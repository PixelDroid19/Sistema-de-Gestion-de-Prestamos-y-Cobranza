import type { ReactNode } from 'react';
import { FINANCIAL_SCHEDULE_TABLE_CLASS } from './tableActionStyles';

type FinancialScheduleTableProps = {
  children: ReactNode;
  className?: string;
  surfaceClassName?: string;
  tableClassName?: string;
  financialLayout?: 'schedule' | 'credit-calendar';
  /** When true, wraps the table in a horizontal scroller with min-width (wide grids only). */
  horizontalScroll?: boolean;
  /** Omits outer bordered shell when the table lives inside another `.data-table-surface`. */
  embeddedInSurface?: boolean;
  minWidthClassName?: string;
  'data-tour'?: string;
  'data-testid'?: string;
  visibleFrom?: 'lg' | 'md' | 'always';
};

const visibilityClassNames = {
  lg: 'hidden lg:block',
  md: 'hidden md:block',
  always: 'block',
} as const;

export function FinancialScheduleTable({
  children,
  className = '',
  surfaceClassName = '',
  tableClassName = '',
  financialLayout = 'schedule',
  horizontalScroll = false,
  embeddedInSurface = false,
  minWidthClassName = 'min-w-[1040px]',
  'data-tour': dataTour,
  'data-testid': dataTestId,
  visibleFrom = 'lg',
}: FinancialScheduleTableProps) {
  const table = (
    <table
      data-tour={dataTour}
      data-testid={dataTestId}
      className={[
        FINANCIAL_SCHEDULE_TABLE_CLASS,
        'w-full text-sm text-left',
        horizontalScroll ? minWidthClassName : 'min-w-0',
        tableClassName,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </table>
  );

  const scroll = <div className="financial-schedule-scroll">{table}</div>;

  if (embeddedInSurface) {
    return (
      <div className={[visibilityClassNames[visibleFrom], surfaceClassName, className].filter(Boolean).join(' ')}>
        {scroll}
      </div>
    );
  }

  return (
    <div
      className={[
        'data-table-surface',
        visibilityClassNames[visibleFrom],
        surfaceClassName,
        className,
      ].filter(Boolean).join(' ')}
    >
      {scroll}
    </div>
  );
}
