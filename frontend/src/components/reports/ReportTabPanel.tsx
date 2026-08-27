import { useId, useState, type FormEventHandler, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { ReportFiltersPanel, ReportFiltersToggle } from './ReportCollapsibleFilters';
import { ReportTabActionsBar } from './ReportTabActionsBar';

type FilterColumns = 1 | 2 | 3 | 4 | 5;

type ReportTabPanelProps = {
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  primaryFilters?: ReactNode;
  filters?: ReactNode;
  secondaryFilters?: ReactNode;
  filterColumns?: FilterColumns;
  activeFilterCount?: number;
  activeFilters?: ReportActiveFilter[];
  onClearAllFilters?: () => void;
  /** @deprecated Prefer headerActions; kept for footer toolbars */
  actions?: ReactNode;
  children?: ReactNode;
  as?: 'section' | 'form';
  onSubmit?: FormEventHandler<HTMLElement>;
  className?: string;
};

export type ReportActiveFilter = {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
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
  primaryFilters,
  filters,
  secondaryFilters,
  filterColumns = 3,
  activeFilterCount = 0,
  activeFilters = [],
  onClearAllFilters,
  actions,
  children,
  as: Component = 'section',
  onSubmit,
  className = '',
}: ReportTabPanelProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersPanelId = useId();
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
          {(hasFilters || headerActions) ? (
            <div className="report-tab-panel__toolbar">
              {hasFilters ? (
                <ReportFiltersToggle
                  activeCount={activeFilterCount}
                  isOpen={filtersOpen}
                  onToggle={() => setFiltersOpen((value) => !value)}
                  panelId={filtersPanelId}
                />
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
        </div>
      ) : null}
      {primaryFilters ? <div className="report-tab-panel__primary-filters">{primaryFilters}</div> : null}
      {(hasFilters || activeFilters.length > 0) ? (
        <div className="report-tab-panel__filter-tools" data-active-filter-count={activeFilterCount}>
          <ReportFiltersPanel
            filterColumns={filterColumns}
            isOpen={filtersOpen}
            panelId={filtersPanelId}
          >
            {filters}
            {secondaryFilters ? <div className="report-tab-panel__secondary-filters">{secondaryFilters}</div> : null}
          </ReportFiltersPanel>
          {activeFilters.length > 0 ? (
            <div className="report-active-filter-row">
              <ul className="report-active-filters" aria-label={tTerm('reports.filters.active')}>
                {activeFilters.map((filter) => (
                  <li key={filter.id} className="report-active-filters__item">
                    <span>{filter.label}: {filter.value}</span>
                    <button
                      type="button"
                      className="report-active-filters__remove"
                      onClick={filter.onRemove}
                      aria-label={tTerm('reports.filters.remove', { filter: filter.label })}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              {onClearAllFilters ? (
                <button type="button" className="report-active-filter-row__clear" onClick={onClearAllFilters}>
                  {tTerm('reports.filters.clearAll')}
                </button>
              ) : null}
            </div>
          ) : null}
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
