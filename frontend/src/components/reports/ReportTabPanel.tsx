import type { FormEventHandler, ReactNode } from 'react';
import { ReportTabActionsBar } from './ReportTabActionsBar';

type FilterColumns = 1 | 2 | 3 | 4 | 5;

type ReportTabPanelProps = {
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  filters?: ReactNode;
  secondaryFilters?: ReactNode;
  filterColumns?: FilterColumns;
  activeFilterCount?: number;
  /** @deprecated Prefer headerActions; kept for footer toolbars */
  actions?: ReactNode;
  children?: ReactNode;
  as?: 'section' | 'form';
  onSubmit?: FormEventHandler<HTMLElement>;
  className?: string;
};

type ReportTableHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function ReportTabPanel({
  title,
  subtitle,
  headerActions,
  filters,
  secondaryFilters,
  filterColumns = 3,
  activeFilterCount = 0,
  actions,
  children,
  as: Component = 'section',
  onSubmit,
  className = '',
}: ReportTabPanelProps) {
  const filterClassName = `report-tab-panel__filters report-tab-panel__filters--cols-${filterColumns}`;
  const hasHeaderCopy = Boolean(title || subtitle);
  const hasFilters = Boolean(filters || secondaryFilters);
  const hasHeader = hasHeaderCopy || Boolean(headerActions) || hasFilters;
  return (
    <Component
      className={`report-tab-panel ${className}`.trim()}
      onSubmit={Component === 'form' ? onSubmit : undefined}
    >
      {hasHeader ? (
        <div className={`report-tab-panel__header ${hasHeaderCopy ? '' : 'report-tab-panel__header--actions-only'}`.trim()}>
          {hasHeaderCopy ? (
            <div className="report-tab-panel__header-copy min-w-0">
              {title ? <h3 className="report-tab-panel__title">{title}</h3> : null}
              {subtitle ? <p className="report-tab-panel__subtitle">{subtitle}</p> : null}
            </div>
          ) : null}
          {headerActions ? (
            <div className="report-tab-panel__header-actions">
              <ReportTabActionsBar>
                {headerActions}
              </ReportTabActionsBar>
            </div>
          ) : null}
        </div>
      ) : null}
      {hasFilters ? (
        <div className="report-tab-panel__filter-panel" data-active-filter-count={activeFilterCount}>
          {filters ? <div className={filterClassName}>{filters}</div> : null}
          {secondaryFilters ? <div className="report-tab-panel__secondary-filters">{secondaryFilters}</div> : null}
        </div>
      ) : null}
      {actions ? <div className="report-tab-panel__actions">{actions}</div> : null}
      {children}
    </Component>
  );
}

export function ReportTableHeader({
  title,
  subtitle,
  actions,
  className = '',
}: ReportTableHeaderProps) {
  return (
    <div className={`report-table-header ${className}`.trim()}>
      <div className="report-table-header__copy min-w-0">
        <h3 className="report-tab-panel__title">{title}</h3>
        {subtitle ? <p className="report-tab-panel__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="report-table-header__actions">{actions}</div> : null}
    </div>
  );
}
