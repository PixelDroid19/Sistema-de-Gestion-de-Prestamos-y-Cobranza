import { useEffect, useId, useState, type FormEventHandler, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { ActionButton } from '../shared/Surfaces';
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
  filtersDefaultOpen?: boolean;
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
  filtersDefaultOpen = false,
  actions,
  children,
  as: Component = 'section',
  onSubmit,
  className = '',
}: ReportTabPanelProps) {
  const [filtersOpen, setFiltersOpen] = useState(filtersDefaultOpen || activeFilterCount > 0);
  const filtersId = useId();
  const filterClassName = `report-tab-panel__filters report-tab-panel__filters--cols-${filterColumns}`;
  const hasHeaderCopy = Boolean(title || subtitle);
  const hasFilters = Boolean(filters || secondaryFilters);
  const hasHeader = hasHeaderCopy || Boolean(headerActions) || hasFilters;
  const filtersLabel = activeFilterCount > 0
    ? tTerm('reports.filters.labelWithCount', { count: activeFilterCount })
    : tTerm('reports.filters.label');

  useEffect(() => {
    if (activeFilterCount > 0) {
      setFiltersOpen(true);
    }
  }, [activeFilterCount]);

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
          {hasFilters || headerActions ? (
            <div className="report-tab-panel__header-actions">
              <ReportTabActionsBar>
                {hasFilters ? (
                  <ActionButton
                    type="button"
                    variant="ghost"
                    icon={<SlidersHorizontal size={16} />}
                    aria-expanded={filtersOpen}
                    aria-controls={filtersId}
                    onClick={() => setFiltersOpen((open) => !open)}
                  >
                    {filtersLabel}
                  </ActionButton>
                ) : null}
                {headerActions}
              </ReportTabActionsBar>
            </div>
          ) : null}
        </div>
      ) : null}
      {hasFilters && filtersOpen ? (
        <div id={filtersId} className="report-tab-panel__filter-panel">
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
