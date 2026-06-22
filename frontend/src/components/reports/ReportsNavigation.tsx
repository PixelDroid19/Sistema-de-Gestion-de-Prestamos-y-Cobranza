import { useMemo } from 'react';

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
  title: string;
  subtitle: string;
  'data-tour'?: string;
};

export default function ReportsNavigation({
  groups,
  activeTab,
  onChange,
  primaryAriaLabel,
  title,
  subtitle,
  'data-tour': dataTour,
}: ReportsNavigationProps) {
  const selectableReports = useMemo(
    () => groups.flatMap((group) => group.leaves.map((leaf) => leaf.id)),
    [groups],
  );
  const activeReportStillVisible = selectableReports.includes(activeTab);

  return (
    <section className="reports-navigation" aria-label={primaryAriaLabel} data-tour={dataTour}>
      <div className="reports-navigation__header">
        <div>
          <h3 className="reports-navigation__title">{title}</h3>
          <p className="reports-navigation__subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="reports-navigation__groups">
        {groups.map((group) => (
          <div key={group.id} className={`reports-navigation__group reports-navigation__group--${group.id}`}>
            <p className="reports-navigation__group-label">{group.label}</p>
            <div className={`reports-navigation__list reports-navigation__list--${group.id}`}>
              {group.leaves.map((leaf, index) => {
                const selected = activeReportStillVisible && activeTab === leaf.id;
                return (
                  <button
                    key={leaf.id}
                    type="button"
                    className={`reports-navigation__item reports-navigation__item--${group.id} ${selected ? 'reports-navigation__item--active' : ''}`}
                    onClick={() => onChange(leaf.id)}
                    aria-label={leaf.label}
                    aria-pressed={selected}
                  >
                    <span className="reports-navigation__item-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <span className="reports-navigation__item-copy">
                      <span className="reports-navigation__item-title">{leaf.label}</span>
                      {leaf.title ? <span className="reports-navigation__item-text">{leaf.title}</span> : null}
                    </span>
                    <span className="reports-navigation__item-state" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
