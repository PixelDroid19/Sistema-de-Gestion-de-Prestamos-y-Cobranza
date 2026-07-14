import { useId, type ReactNode } from 'react';
import { OperationalSelect } from '../shared/Surfaces';
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
  /** Secondary management tools rendered next to the report tabs (not query reports). */
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
  const selectId = useId();
  const activeGroup = groups.find((group) => group.leaves.some((leaf) => leaf.id === activeTab)) || groups[0];

  if (!activeGroup) {
    return null;
  }

  return (
    <section className="reports-module-nav" aria-label={primaryAriaLabel} data-tour={dataTour}>
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
      <div className="reports-module-nav__query">
        <label className="reports-module-nav__select-label" htmlFor={selectId}>
          {tTerm('reports.selector.label')}
        </label>
        <OperationalSelect
          id={selectId}
          value={activeTab}
          onChange={(event) => onChange(event.target.value)}
          className="reports-module-nav__select"
        >
          {activeGroup.leaves.map((leaf) => (
            <option key={leaf.id} value={leaf.id}>{leaf.label}</option>
          ))}
        </OperationalSelect>
      </div>
      {tools ? (
        <div className="reports-module-nav__tools">
          {tools}
        </div>
      ) : null}
    </section>
  );
}
