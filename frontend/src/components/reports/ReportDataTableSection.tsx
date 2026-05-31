import type { ReactNode } from 'react';
import { DataTableSurface } from '../shared/Surfaces';

type ReportDataTableSectionProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Table block with an optional compact caption; avoids duplicating the main tab panel title. */
export function ReportDataTableSection({
  title,
  subtitle,
  children,
  footer,
}: ReportDataTableSectionProps) {
  return (
    <DataTableSurface>
      {title ? (
        <div className="report-data-table-section__head">
          <h4 className="report-data-table-section__title">{title}</h4>
          {subtitle ? <p className="report-data-table-section__subtitle">{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
      {footer}
    </DataTableSurface>
  );
}
