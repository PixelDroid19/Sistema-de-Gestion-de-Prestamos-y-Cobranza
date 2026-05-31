import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { ActionButton } from '../shared/Surfaces';

type FilterColumns = 2 | 3 | 4;

type ReportCollapsibleFiltersProps = {
  children: ReactNode;
  activeCount?: number;
  defaultOpen?: boolean;
  filterColumns?: FilterColumns;
};

export function ReportCollapsibleFilters({
  children,
  activeCount = 0,
  defaultOpen = false,
  filterColumns = 2,
}: ReportCollapsibleFiltersProps) {
  const [open, setOpen] = useState(defaultOpen || activeCount > 0);
  const panelId = useId();

  useEffect(() => {
    if (activeCount > 0) {
      setOpen(true);
    }
  }, [activeCount]);

  const toggleLabel = open
    ? tTerm('reports.export.toggle.hide')
    : (activeCount > 0
      ? tTerm('reports.export.toggle.showWithCount', { count: activeCount })
      : tTerm('reports.export.toggle.show'));

  return (
    <div className="report-collapsible-filters">
      <ActionButton
        type="button"
        variant="ghost"
        className="report-collapsible-filters__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        icon={(
          <ChevronDown
            size={16}
            className={open ? 'report-collapsible-filters__chevron report-collapsible-filters__chevron--open' : 'report-collapsible-filters__chevron'}
            aria-hidden="true"
          />
        )}
      >
        {toggleLabel}
      </ActionButton>
      {open ? (
        <div
          id={panelId}
          className={`report-tab-panel__filters report-tab-panel__filters--cols-${filterColumns} report-collapsible-filters__panel`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
