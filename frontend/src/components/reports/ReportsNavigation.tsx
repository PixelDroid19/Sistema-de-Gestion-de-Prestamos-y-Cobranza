import type { ReactNode } from 'react';
import { ViewTabs } from '../shared/Surfaces';

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
  const reports = groups.flatMap((group) => group.leaves);

  return (
    <section className="reports-module-nav" aria-label={primaryAriaLabel} data-tour={dataTour}>
      <ViewTabs
        className="reports-module-nav__tabs"
        tabs={reports.map((leaf) => ({ id: leaf.id, label: leaf.label, title: leaf.title }))}
        activeTab={activeTab}
        onChange={onChange}
        ariaLabel={primaryAriaLabel}
      />
      {tools ? (
        <div className="reports-module-nav__tools">
          {tools}
        </div>
      ) : null}
    </section>
  );
}
