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
      <div className="reports-module-nav__selection">
        <div className="reports-module-nav__categories" role="radiogroup" aria-label={tTerm('reports.categories.aria')}>
          {groups.map((group) => (
            <label key={group.id} className="reports-module-nav__category">
              <input
                type="radio"
                name="report-category"
                value={group.id}
                checked={group.id === activeGroup.id}
                onChange={() => onChange(group.leaves[0].id)}
              />
              <span>{group.label}</span>
            </label>
          ))}
        </div>
        <div className="reports-module-nav__reports" role="group" aria-label={tTerm('reports.selector.label')}>
          {activeGroup.leaves.map((leaf) => (
            <button
              key={leaf.id}
              type="button"
              className="reports-module-nav__report"
              aria-pressed={leaf.id === activeTab}
              title={leaf.title}
              onClick={() => onChange(leaf.id)}
            >
              {leaf.label}
            </button>
          ))}
        </div>
      </div>
      {tools ? (
        <div className="reports-module-nav__tools">
          {tools}
        </div>
      ) : null}
    </section>
  );
}
