import type { ReactNode } from 'react';
import { tTerm } from '../../i18n/terminology';

export type ReportLeaf = {
  id: string;
  label: string;
  title?: string;
};

export type ReportGroup = {
  id: string;
  label: string;
  title?: string;
  leaves: ReportLeaf[];
};

type ReportsNavigationProps = {
  groups: ReportGroup[];
  activeTab: string;
  onChange: (leafId: string) => void;
  primaryAriaLabel: string;
  /** Secondary management tools rendered next to the report navigation. */
  tools?: ReactNode;
  'data-tour'?: string;
};

export default function ReportsNavigation({
  groups,
  activeTab,
  onChange,
  primaryAriaLabel,
  tools,
  'data-tour': dataTour,
}: ReportsNavigationProps) {
  const activeGroup = groups.find((group) => group.leaves.some((leaf) => leaf.id === activeTab)) || groups[0];

  if (!activeGroup) {
    return null;
  }

  return (
    <section className="reports-module-nav" aria-label={primaryAriaLabel} data-tour={dataTour}>
      <label className="reports-module-nav__compact">
        <span>{tTerm('reports.selector.label')}</span>
        <select value={activeTab} onChange={(event) => onChange(event.target.value)}>
          {groups.map((group) => (
            <optgroup key={group.id} label={group.label}>
              {group.leaves.map((leaf) => <option key={leaf.id} value={leaf.id}>{leaf.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      {tools ? (
        <div className="reports-module-nav__tools">
          {tools}
        </div>
      ) : null}
    </section>
  );
}
