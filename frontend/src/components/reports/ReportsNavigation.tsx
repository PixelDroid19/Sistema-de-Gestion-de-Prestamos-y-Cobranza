import { useMemo } from 'react';
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
  secondaryAriaLabel: string;
  'data-tour'?: string;
};

export default function ReportsNavigation({
  groups,
  activeTab,
  onChange,
  primaryAriaLabel,
  'data-tour': dataTour,
}: ReportsNavigationProps) {
  const tabs = useMemo(
    () => groups.flatMap((group) => group.leaves.map((leaf) => ({
      id: leaf.id,
      label: leaf.label,
      title: leaf.title || group.title,
    }))),
    [groups],
  );

  return (
    <div className="reports-navigation">
      <ViewTabs
        data-tour={dataTour}
        activeTab={activeTab}
        onChange={onChange}
        tabs={tabs}
        className="reports-page-tabs"
        ariaLabel={primaryAriaLabel}
      />
    </div>
  );
}
