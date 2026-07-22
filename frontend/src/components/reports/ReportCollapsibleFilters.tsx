import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { ActionButton } from '../shared/Surfaces';

type FilterColumns = 1 | 2 | 3 | 4 | 5;

type ReportCollapsibleFiltersProps = {
  children: ReactNode;
  activeCount?: number;
  defaultOpen?: boolean;
  filterColumns?: FilterColumns;
};

type ReportFiltersToggleProps = {
  activeCount?: number;
  isOpen: boolean;
  onToggle: () => void;
  panelId: string;
};

type ReportFiltersPanelProps = {
  children: ReactNode;
  filterColumns?: FilterColumns;
  isOpen: boolean;
  panelId: string;
};

export function ReportFiltersToggle({
  activeCount = 0,
  isOpen,
  onToggle,
  panelId,
}: ReportFiltersToggleProps) {
  const toggleLabel = activeCount > 0
    ? tTerm('reports.filters.labelWithCount', { count: activeCount })
    : tTerm('reports.filters.label');

  return (
    <ActionButton
      type="button"
      variant="secondary"
      className="report-collapsible-filters__toggle"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={panelId}
      icon={(
        <ChevronDown
          size={16}
          className={isOpen ? 'report-collapsible-filters__chevron report-collapsible-filters__chevron--open' : 'report-collapsible-filters__chevron'}
          aria-hidden="true"
        />
      )}
    >
      {toggleLabel}
    </ActionButton>
  );
}

export function ReportFiltersPanel({
  children,
  filterColumns = 2,
  isOpen,
  panelId,
}: ReportFiltersPanelProps) {
  return (
    <div
      id={panelId}
      className={`report-tab-panel__filters report-tab-panel__filters--cols-${filterColumns} report-collapsible-filters__panel`}
      hidden={!isOpen}
    >
      {children}
    </div>
  );
}

export function ReportCollapsibleFilters({
  children,
  activeCount = 0,
  defaultOpen = false,
  filterColumns = 2,
}: ReportCollapsibleFiltersProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="report-collapsible-filters">
      <ReportFiltersToggle
        activeCount={activeCount}
        isOpen={open}
        onToggle={() => setOpen((value) => !value)}
        panelId={panelId}
      />
      <ReportFiltersPanel
        filterColumns={filterColumns}
        isOpen={open}
        panelId={panelId}
      >
        {children}
      </ReportFiltersPanel>
    </div>
  );
}
